// ================== Tad Fane Resort — Server ==================
// Node.js ລ້ວນໆ (ບໍ່ຕ້ອງ npm install ຫຍັງເພີ່ມ). ໜ້າທີ່:
//  - ເກັບຂໍ້ມູນກາງ (server/data/db.json) ໃຫ້ທຸກເຄື່ອງເຫັນຂໍ້ມູນດຽວກັນ
//  - ກວດລະຫັດຜ່ານ / session ຢູ່ຝັ່ງ server
//  - ສົ່ງການປ່ຽນແປງແບບ real-time (Server-Sent Events)
//  - API ສາທາລະນະໃຫ້ລູກຄ້າຈອງອອນລາຍ
//  - Backup ອັດຕະໂນມັດທຸກມື້ + ດາວໂຫຼດ/ກູ້ຄືນ
//  - ແຈ້ງເຕືອນ Telegram ເມື່ອມີການຈອງໃໝ່
//  - ໃຫ້ບໍລິການໄຟລ໌ໜ້າເວັບ (dist/)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { Store, COLLECTIONS, DOCS } from './db.js';
import {
  initialRooms, initialHotelInfo, initialActivities, BLOCKING_STATUSES,
  generateBookingId, generatePublicToken,
} from '../src/data/initialData.js';
import { computeStayPrice } from '../src/utils/pricing.js';
import { validatePasswordStrength } from '../src/utils/security.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const PORT = Number(process.env.PORT || 8080);
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;
const PBKDF2_ITERATIONS = 120000;

const store = new Store(DATA_DIR);
const db = () => store.db;

// ---------- ຂໍ້ມູນເລີ່ມຕົ້ນ ----------
function ensureDefaults() {
  const d = db();
  if (!d.docs.hotelInfo) d.docs.hotelInfo = { ...initialHotelInfo };
  const acts = d.collections.guestActivities;
  for (const init of initialActivities) {
    if (!acts.some(a => a.id === init.id)) acts.push({ ...init });
  }
  store.save();
}
ensureDefaults();

// ================== HELPERS ==================
const pad = (n) => String(n).padStart(2, '0');
const todayLocal = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const sha256 = (s) => crypto.createHash('sha256').update(s).digest('hex');
const newId = (prefix) => `${prefix}-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

function hashPassword(password, saltHex) {
  return crypto.pbkdf2Sync(String(password), Buffer.from(saltHex, 'hex'), PBKDF2_ITERATIONS, 32, 'sha256').toString('hex');
}
function createPasswordRecord(password) {
  const passwordSalt = crypto.randomBytes(16).toString('hex');
  return { passwordSalt, passwordHash: hashPassword(password, passwordSalt) };
}
function verifyPassword(password, user) {
  if (!user?.passwordHash || !user?.passwordSalt) return false;
  const a = Buffer.from(hashPassword(password, user.passwordSalt), 'hex');
  const b = Buffer.from(user.passwordHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && crypto.timingSafeEqual(x, y);
}

const publicUser = (u) => {
  if (!u) return null;
  // eslint-disable-next-line no-unused-vars
  const { password, passwordHash, passwordSalt, ...rest } = u;
  return rest;
};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function send(res, status, data, headers = {}) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers,
  });
  res.end(body);
}

function readBody(req, limitBytes = 25 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limitBytes) { reject(new HttpError(413, 'ຂໍ້ມູນໃຫຍ່ເກີນໄປ')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch { reject(new HttpError(400, 'ຮູບແບບຂໍ້ມູນບໍ່ຖືກຕ້ອງ')); }
    });
    req.on('error', reject);
  });
}

function clientIp(req) {
  return (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '';
}

// ---------- Rate limit (ສຳລັບ API ສາທາລະນະ) ----------
const rateBuckets = new Map();
function rateLimit(req, key, max, windowMs) {
  const k = `${key}:${clientIp(req)}`;
  const now = Date.now();
  const arr = (rateBuckets.get(k) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'ສົ່ງຄຳຂໍຫຼາຍເກີນໄປ ກະລຸນາລໍຖ້າບຶດໜຶ່ງ');
  arr.push(now);
  rateBuckets.set(k, arr);
}

// ================== PERMISSIONS ==================
const READ = {
  owner: COLLECTIONS,
  reception: COLLECTIONS.filter(c => c !== 'auditLog'),
  housekeeping: ['rooms', 'bookings', 'maintenanceLogs', 'guestActivities', 'ratePlans'],
};
const WRITE = {
  owner: COLLECTIONS.filter(c => c !== 'auditLog'),
  reception: ['rooms', 'bookings', 'activitySales', 'shiftCloses', 'expenses', 'maintenanceLogs'],
  housekeeping: ['rooms', 'maintenanceLogs'],
};
const DOC_WRITE = { owner: ['hotelInfo'], reception: [], housekeeping: [] };

const canRead = (role, coll) => (READ[role] || []).includes(coll);
const canWrite = (role, coll) => (WRITE[role] || []).includes(coll);

// ================== SESSIONS ==================
function startSession(user) {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  db().sessions = db().sessions.filter(s => new Date(s.expiresAt).getTime() > now);
  db().sessions.push({
    id: sha256(token),
    userId: user.id,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + SESSION_HOURS * 3600 * 1000).toISOString(),
  });
  store.save();
  return token;
}

function getAuth(req, url) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : url.searchParams.get('token');
  if (!token) return null;
  const hash = sha256(token);
  const s = db().sessions.find(x => x.id === hash);
  if (!s || new Date(s.expiresAt) < new Date()) return null;
  const user = db().users.find(u => u.id === s.userId);
  if (!user || user.active === false) return null;
  return { user, session: s, token };
}

function requireAuth(req, url, roles = null) {
  const auth = getAuth(req, url);
  if (!auth) throw new HttpError(401, 'ກະລຸນາເຂົ້າລະບົບໃໝ່');
  if (roles && !roles.includes(auth.user.role)) throw new HttpError(403, 'ທ່ານບໍ່ມີສິດໃຊ້ງານສ່ວນນີ້');
  return auth;
}

function dropSessionsForUser(userId) {
  db().sessions = db().sessions.filter(s => s.userId !== userId);
}

const needsSetup = () => !db().users.some(u => u.role === 'owner' && u.active !== false);

// ================== AUDIT ==================
function audit(user, action, details = '', meta = {}) {
  const entry = {
    id: newId('LG'),
    at: new Date().toISOString(),
    userId: user?.id || null,
    username: user?.username || (user === null ? 'guest' : 'system'),
    userName: user?.name || (user === null ? 'ລູກຄ້າ (ອອນລາຍ)' : 'ລະບົບ'),
    role: user?.role || null,
    action,
    details: String(details || '').slice(0, 1000),
    meta: meta && typeof meta === 'object' ? meta : {},
  };
  store.applyOps('auditLog', [{ op: 'upsert', item: entry, index: 0 }]);
  broadcast({ type: 'ops', coll: 'auditLog', ops: [{ op: 'upsert', item: entry, index: 0 }] });
  return entry;
}

// ================== REAL-TIME (SSE) ==================
const clients = new Set(); // { res, role, userId, clientId }

function broadcast(msg, { exceptClientId = null } = {}) {
  const data = `data: ${JSON.stringify(msg)}\n\n`;
  for (const c of clients) {
    if (exceptClientId && c.clientId === exceptClientId) continue;
    if (msg.type === 'ops' && !canRead(c.role, msg.coll)) continue;
    if (msg.type === 'notify' && c.role === 'housekeeping') continue;
    try { c.res.write(data); } catch { /* ignore */ }
  }
}

setInterval(() => {
  for (const c of clients) {
    try { c.res.write(': ping\n\n'); } catch { /* ignore */ }
  }
}, 25000).unref();

// ================== TELEGRAM ==================
async function notifyTelegram(text) {
  const tg = db().private.telegram || {};
  if (!tg.enabled || !tg.botToken || !tg.chatId) return { ok: false, skipped: true };
  try {
    const r = await fetch(`https://api.telegram.org/bot${tg.botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: tg.chatId, text, disable_web_page_preview: true }),
      signal: AbortSignal.timeout(10000),
    });
    const j = await r.json().catch(() => ({}));
    if (!j.ok) console.error('[telegram]', j.description || r.status);
    return { ok: !!j.ok, error: j.description };
  } catch (e) {
    console.error('[telegram]', e.message);
    return { ok: false, error: e.message };
  }
}

const fmtKip = (n) => `${new Intl.NumberFormat('en-US').format(Math.round(Number(n) || 0))} ₭`;

// ================== STATE ==================
function stateFor(user) {
  const d = db();
  const collections = {};
  for (const c of COLLECTIONS) if (canRead(user.role, c)) collections[c] = d.collections[c];
  return { collections, docs: { hotelInfo: d.docs.hotelInfo }, serverTime: new Date().toISOString() };
}

function publicCatalog() {
  const d = db();
  return {
    rooms: d.collections.rooms.map(r => {
      // eslint-disable-next-line no-unused-vars
      const { currentBookingId, ...rest } = r;
      return rest;
    }),
    hotelInfo: d.docs.hotelInfo,
    guestActivities: d.collections.guestActivities,
    ratePlans: d.collections.ratePlans.filter(p => p.active !== false),
    busy: d.collections.bookings
      .filter(b => BLOCKING_STATUSES.includes(b.status))
      .map(b => ({ id: `busy-${sha256(b.id).slice(0, 10)}`, roomId: b.roomId, checkIn: b.checkIn, checkOut: b.checkOut, status: b.status })),
  };
}

function publicBookingView(b) {
  const room = db().collections.rooms.find(r => r.id === b.roomId);
  // eslint-disable-next-line no-unused-vars
  const { payments, ...rest } = b;
  return { ...rest, roomNumber: room?.number || b.roomId, roomType: room?.type || b.roomType || 'standard', roomPrice: b.roomPrice || room?.price };
}

// ================== VALIDATION ==================
const str = (v, max = 200) => String(v ?? '').trim().slice(0, max);
const isDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

function normalizeImportedUser(u) {
  if (!u || !u.username) return null;
  let rec = {};
  if (u.passwordHash && u.passwordSalt) rec = { passwordHash: u.passwordHash, passwordSalt: u.passwordSalt };
  else if (typeof u.password === 'string' && u.password) rec = createPasswordRecord(u.password);
  else return null;
  return {
    id: u.id || newId('u'),
    username: str(u.username, 40),
    name: str(u.name || u.username, 100),
    phone: str(u.phone, 40),
    role: ['owner', 'reception', 'housekeeping'].includes(u.role) ? u.role : 'reception',
    active: u.active !== false,
    mustChangePassword: false,
    ...rec,
  };
}

function importLocalData(data) {
  const d = db();
  const list = (v) => (Array.isArray(v) ? v.filter(x => x && x.id != null) : null);
  const map = {
    rooms: list(data.rooms),
    bookings: list(data.bookings),
    activitySales: list(data.activitySales),
    guestActivities: list(data.guestActivities),
    shiftCloses: list(data.shiftCloses),
    auditLog: list(data.auditLog),
  };
  for (const [k, v] of Object.entries(map)) if (v && v.length) d.collections[k] = v;
  // shift closes ເກົ່າບໍ່ມີ id
  if (Array.isArray(data.shiftCloses) && !map.shiftCloses?.length) {
    d.collections.shiftCloses = data.shiftCloses.map((s, i) => ({ id: s.id || `SC-${s.date || i}-${i}`, ...s }));
  }
  if (data.hotelInfo && typeof data.hotelInfo === 'object') d.docs.hotelInfo = { ...initialHotelInfo, ...data.hotelInfo };
  ensureDefaults();
}

// ================== ROUTES ==================
async function handleApi(req, res, url) {
  const p = url.pathname;
  const m = req.method;

  // ---------- Health ----------
  if (p === '/api/health' && m === 'GET') {
    const lanIps = Object.values(os.networkInterfaces()).flat()
      .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
    return send(res, 200, { ok: true, needsSetup: needsSetup(), serverTime: new Date().toISOString(), lanIps, port: PORT });
  }

  // ---------- First-run setup ----------
  if (p === '/api/auth/setup' && m === 'POST') {
    if (!needsSetup()) throw new HttpError(409, 'ລະບົບຕັ້ງຄ່າແລ້ວ');
    const body = await readBody(req);
    if (body.importData) importLocalData(body.importData);

    if (body.mode === 'import') {
      const users = (body.importData?.users || []).map(normalizeImportedUser).filter(Boolean);
      if (!users.some(u => u.role === 'owner' && u.active)) throw new HttpError(400, 'ບໍ່ພົບບັນຊີເຈົ້າຂອງໃນຂໍ້ມູນເກົ່າ ກະລຸນາສ້າງບັນຊີໃໝ່');
      db().users = users;
      store.flush();
      audit(undefined, 'system.import', `ນຳເຂົ້າຂໍ້ມູນເກົ່າຈາກ browser (${users.length} ບັນຊີ)`);
      return send(res, 200, { ok: true, imported: true });
    }

    const o = body.owner || {};
    const username = str(o.username, 40);
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) throw new HttpError(400, 'ຊື່ຜູ້ໃຊ້ຕ້ອງເປັນ a-z, 0-9 ຢ່າງໜ້ອຍ 3 ຕົວ');
    if (!str(o.name)) throw new HttpError(400, 'ກະລຸນາໃສ່ຊື່');
    const pwErr = validatePasswordStrength(o.password, username);
    if (pwErr) throw new HttpError(400, pwErr);
    const owner = {
      id: newId('u'), username, name: str(o.name, 100), phone: str(o.phone, 40),
      role: 'owner', active: true, mustChangePassword: false, ...createPasswordRecord(o.password),
    };
    // ເກັບບັນຊີພະນັກງານເກົ່າ (ຖ້ານຳເຂົ້າ) ທີ່ຊື່ບໍ່ຊ້ຳ
    const oldUsers = (body.importData?.users || []).map(normalizeImportedUser).filter(Boolean)
      .filter(u => u.username.toLowerCase() !== username.toLowerCase());
    db().users = [owner, ...oldUsers];
    if (db().collections.rooms.length === 0) db().collections.rooms = initialRooms.map(r => ({ ...r }));
    const token = startSession(owner);
    store.flush();
    audit(owner, 'user.create', `ສ້າງບັນຊີເຈົ້າຂອງ "${owner.username}" (ຕັ້ງຄ່າຄັ້ງທຳອິດ)`);
    return send(res, 200, { ok: true, token, user: publicUser(owner) });
  }

  // ---------- Login ----------
  if (p === '/api/auth/login' && m === 'POST') {
    rateLimit(req, 'login', 30, 10 * 60000);
    const body = await readBody(req, 64 * 1024);
    const uname = str(body.username, 40).toLowerCase();
    const attempts = loginAttempts.get(uname) || { count: 0, lockedUntil: 0 };
    if (attempts.lockedUntil > Date.now()) {
      const mins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
      throw new HttpError(423, `ບັນຊີນີ້ຖືກລັອກຊົ່ວຄາວ ເນື່ອງຈາກໃສ່ລະຫັດຜິດຫຼາຍເທື່ອ. ກະລຸນາລອງໃໝ່ໃນ ${mins} ນາທີ`);
    }
    const user = db().users.find(u => u.username.toLowerCase() === uname);
    const ok = user && user.active !== false && verifyPassword(body.password || '', user);
    if (!ok) {
      attempts.count += 1;
      if (attempts.count >= MAX_ATTEMPTS) {
        attempts.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
        attempts.count = 0;
        audit(user ? publicUser(user) : undefined, 'auth.locked', `ລັອກບັນຊີ "${uname}" ${LOCK_MINUTES} ນາທີ (IP ${clientIp(req)})`);
      } else {
        audit(user ? publicUser(user) : undefined, 'auth.login_failed', `ຊື່ຜູ້ໃຊ້ "${uname}" (ເທື່ອທີ ${attempts.count}, IP ${clientIp(req)})`);
      }
      loginAttempts.set(uname, attempts);
      if (user && user.active === false) throw new HttpError(403, 'ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ');
      throw new HttpError(401, 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ');
    }
    loginAttempts.delete(uname);
    const token = startSession(user);
    audit(user, 'auth.login', `ເຂົ້າລະບົບສຳເລັດ (IP ${clientIp(req)})`);
    return send(res, 200, { ok: true, token, user: publicUser(user) });
  }

  if (p === '/api/auth/logout' && m === 'POST') {
    const auth = getAuth(req, url);
    if (auth) {
      db().sessions = db().sessions.filter(s => s.id !== auth.session.id);
      store.save();
      audit(auth.user, 'auth.logout', 'ອອກຈາກລະບົບ');
    }
    return send(res, 200, { ok: true });
  }

  if (p === '/api/auth/me' && m === 'GET') {
    const { user, session } = requireAuth(req, url);
    return send(res, 200, { user: publicUser(user), expiresAt: session.expiresAt });
  }

  if (p === '/api/auth/change-password' && m === 'POST') {
    const { user, session } = requireAuth(req, url);
    const body = await readBody(req, 64 * 1024);
    if (!verifyPassword(body.currentPassword || '', user)) throw new HttpError(400, 'ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ');
    const pwErr = validatePasswordStrength(body.newPassword, user.username);
    if (pwErr) throw new HttpError(400, pwErr);
    if (verifyPassword(body.newPassword, user)) throw new HttpError(400, 'ລະຫັດຜ່ານໃໝ່ຕ້ອງບໍ່ຊ້ຳກັບລະຫັດເກົ່າ');
    Object.assign(user, createPasswordRecord(body.newPassword), { mustChangePassword: false });
    // ອອກຈາກລະບົບທຸກເຄື່ອງອື່ນ ຍົກເວັ້ນເຄື່ອງນີ້
    db().sessions = db().sessions.filter(s => s.userId !== user.id || s.id === session.id);
    store.save();
    audit(user, 'auth.password_change', 'ປ່ຽນລະຫັດຜ່ານຂອງຕົນເອງ');
    return send(res, 200, { ok: true, user: publicUser(user) });
  }

  // ---------- Users (owner) ----------
  if (p === '/api/users' && m === 'GET') {
    requireAuth(req, url, ['owner']);
    return send(res, 200, { users: db().users.map(publicUser) });
  }
  if (p === '/api/users' && m === 'POST') {
    const { user: me } = requireAuth(req, url, ['owner']);
    const body = await readBody(req, 64 * 1024);
    const username = str(body.username, 40);
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) throw new HttpError(400, 'ຊື່ຜູ້ໃຊ້ຕ້ອງເປັນ a-z, 0-9 ຢ່າງໜ້ອຍ 3 ຕົວ');
    if (db().users.some(u => u.username.toLowerCase() === username.toLowerCase())) throw new HttpError(409, 'ຊື່ຜູ້ໃຊ້ນີ້ມີໃນລະບົບແລ້ວ');
    const pwErr = validatePasswordStrength(body.password, username);
    if (pwErr) throw new HttpError(400, pwErr);
    const role = ['owner', 'reception', 'housekeeping'].includes(body.role) ? body.role : 'reception';
    const nu = {
      id: newId('u'), username, name: str(body.name || username, 100), phone: str(body.phone, 40),
      role, active: true, mustChangePassword: false, ...createPasswordRecord(body.password),
    };
    db().users.push(nu);
    store.save();
    audit(me, 'user.create', `ເພີ່ມຜູ້ໃຊ້ "${nu.username}" (${nu.role})`);
    return send(res, 200, { user: publicUser(nu) });
  }
  const userMatch = p.match(/^\/api\/users\/([^/]+)$/);
  if (userMatch && (m === 'PATCH' || m === 'DELETE')) {
    const { user: me } = requireAuth(req, url, ['owner']);
    const target = db().users.find(u => u.id === decodeURIComponent(userMatch[1]));
    if (!target) throw new HttpError(404, 'ບໍ່ພົບຜູ້ໃຊ້');
    const activeOwners = db().users.filter(u => u.role === 'owner' && u.active !== false);
    const isLastOwner = target.role === 'owner' && target.active !== false && activeOwners.length <= 1;

    if (m === 'DELETE') {
      if (target.id === me.id) throw new HttpError(400, 'ບໍ່ສາມາດລຶບບັນຊີຂອງຕົນເອງໄດ້');
      if (isLastOwner) throw new HttpError(400, 'ຕ້ອງມີເຈົ້າຂອງຢ່າງໜ້ອຍ 1 ບັນຊີ');
      db().users = db().users.filter(u => u.id !== target.id);
      dropSessionsForUser(target.id);
      store.save();
      audit(me, 'user.delete', `ລຶບຜູ້ໃຊ້ "${target.username}"`);
      return send(res, 200, { ok: true });
    }

    const body = await readBody(req, 64 * 1024);
    if (body.username !== undefined) {
      const un = str(body.username, 40);
      if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(un)) throw new HttpError(400, 'ຊື່ຜູ້ໃຊ້ຕ້ອງເປັນ a-z, 0-9 ຢ່າງໜ້ອຍ 3 ຕົວ');
      if (db().users.some(u => u.id !== target.id && u.username.toLowerCase() === un.toLowerCase())) throw new HttpError(409, 'ຊື່ຜູ້ໃຊ້ນີ້ມີໃນລະບົບແລ້ວ');
      target.username = un;
    }
    if (body.name !== undefined) target.name = str(body.name, 100);
    if (body.phone !== undefined) target.phone = str(body.phone, 40);
    if (body.role !== undefined && ['owner', 'reception', 'housekeeping'].includes(body.role)) {
      if (isLastOwner && body.role !== 'owner') throw new HttpError(400, 'ຕ້ອງມີເຈົ້າຂອງຢ່າງໜ້ອຍ 1 ບັນຊີ');
      target.role = body.role;
    }
    if (body.active !== undefined) {
      if (isLastOwner && body.active === false) throw new HttpError(400, 'ຕ້ອງມີເຈົ້າຂອງຢ່າງໜ້ອຍ 1 ບັນຊີ');
      target.active = !!body.active;
      if (!target.active) dropSessionsForUser(target.id);
    }
    let pwNote = '';
    if (body.password) {
      const pwErr = validatePasswordStrength(body.password, target.username);
      if (pwErr) throw new HttpError(400, pwErr);
      Object.assign(target, createPasswordRecord(body.password), { mustChangePassword: target.id !== me.id });
      if (target.id !== me.id) dropSessionsForUser(target.id);
      loginAttempts.delete(target.username.toLowerCase());
      pwNote = ' (ຣີເຊັດລະຫັດຜ່ານ)';
    }
    store.save();
    audit(me, 'user.update', `ແກ້ໄຂຜູ້ໃຊ້ "${target.username}"${pwNote}`);
    return send(res, 200, { user: publicUser(target) });
  }

  // ---------- State + sync (staff) ----------
  if (p === '/api/state' && m === 'GET') {
    const { user } = requireAuth(req, url);
    return send(res, 200, stateFor(user));
  }

  if (p === '/api/sync' && m === 'POST') {
    const { user } = requireAuth(req, url);
    const body = await readBody(req);
    const clientId = str(body.clientId, 80);
    let rejected = 0;
    for (const item of Array.isArray(body.batch) ? body.batch : []) {
      if (item.type === 'ops') {
        if (!COLLECTIONS.includes(item.coll) || !canWrite(user.role, item.coll) || !Array.isArray(item.ops)) { rejected++; continue; }
        const ops = item.ops.filter(o => (o.op === 'upsert' && o.item && o.item.id != null) || (o.op === 'delete' && o.id != null));
        if (!ops.length) continue;
        store.applyOps(item.coll, ops);
        broadcast({ type: 'ops', coll: item.coll, ops }, { exceptClientId: clientId });
      } else if (item.type === 'doc') {
        if (!DOCS.includes(item.name) || !(DOC_WRITE[user.role] || []).includes(item.name)) { rejected++; continue; }
        store.setDoc(item.name, item.value);
        broadcast({ type: 'doc', name: item.name, value: item.value }, { exceptClientId: clientId });
      } else if (item.type === 'audit' && item.entry) {
        audit(user, str(item.entry.action, 60), item.entry.details, item.entry.meta);
      }
    }
    return send(res, 200, { ok: true, rejected });
  }

  if (p === '/api/events' && m === 'GET') {
    const { user } = requireAuth(req, url);
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    const client = { res, role: user.role, userId: user.id, clientId: str(url.searchParams.get('clientId'), 80) };
    clients.add(client);
    req.on('close', () => clients.delete(client));
    return undefined;
  }

  // ---------- Admin: backup / restore / notifications ----------
  if (p === '/api/admin/backup' && m === 'GET') {
    const { user } = requireAuth(req, url, ['owner']);
    const d = db();
    const backup = {
      format: 'tadfane-backup', schema: d.schema, exportedAt: new Date().toISOString(), exportedBy: user.username,
      users: d.users, collections: d.collections, docs: d.docs,
    };
    audit(user, 'system.backup', 'ດາວໂຫຼດໄຟລ໌ສຳຮອງຂໍ້ມູນ');
    return send(res, 200, backup, { 'Content-Disposition': `attachment; filename="tadfane-backup-${todayLocal()}.json"` });
  }

  if (p === '/api/admin/restore' && m === 'POST') {
    const { user } = requireAuth(req, url, ['owner']);
    const body = await readBody(req, 200 * 1024 * 1024);
    const b = body.backup;
    if (!b || b.format !== 'tadfane-backup' || !b.collections) throw new HttpError(400, 'ໄຟລ໌ນີ້ບໍ່ແມ່ນໄຟລ໌ສຳຮອງຂອງລະບົບ');
    const users = Array.isArray(b.users) ? b.users.map(normalizeImportedUser).filter(Boolean) : null;
    if (users && !users.some(u => u.role === 'owner' && u.active)) throw new HttpError(400, 'ໄຟລ໌ສຳຮອງບໍ່ມີບັນຊີເຈົ້າຂອງ');
    // ເກັບສຳເນົາກ່ອນກູ້ຄືນ
    store.flush();
    fs.copyFileSync(store.file, path.join(store.backupDir, `pre-restore-${Date.now()}.json`));
    const d = db();
    for (const c of COLLECTIONS) d.collections[c] = Array.isArray(b.collections[c]) ? b.collections[c] : [];
    if (b.docs?.hotelInfo) d.docs.hotelInfo = b.docs.hotelInfo;
    if (users) {
      d.users = users;
      const ids = new Set(users.map(u => u.id));
      d.sessions = d.sessions.filter(s => ids.has(s.userId));
    }
    ensureDefaults();
    store.flush();
    audit(user, 'system.restore', `ກູ້ຄືນຂໍ້ມູນຈາກໄຟລ໌ສຳຮອງ (${b.exportedAt || '-'})`);
    broadcast({ type: 'reload' });
    return send(res, 200, { ok: true });
  }

  if (p === '/api/admin/backups' && m === 'GET') {
    requireAuth(req, url, ['owner']);
    const files = fs.readdirSync(store.backupDir).filter(f => f.endsWith('.json')).sort().reverse()
      .map(f => ({ name: f, size: fs.statSync(path.join(store.backupDir, f)).size }));
    return send(res, 200, { files, dir: store.backupDir });
  }

  if (p === '/api/admin/notify' && m === 'GET') {
    requireAuth(req, url, ['owner']);
    const tg = db().private.telegram || {};
    return send(res, 200, { enabled: !!tg.enabled, chatId: tg.chatId || '', hasToken: !!tg.botToken });
  }
  if (p === '/api/admin/notify' && m === 'PUT') {
    const { user } = requireAuth(req, url, ['owner']);
    const body = await readBody(req, 64 * 1024);
    const tg = db().private.telegram || (db().private.telegram = {});
    tg.enabled = !!body.enabled;
    tg.chatId = str(body.chatId, 60);
    if (body.botToken) tg.botToken = str(body.botToken, 120);
    if (body.clearToken) tg.botToken = '';
    store.save();
    audit(user, 'system.notify', `ຕັ້ງຄ່າແຈ້ງເຕືອນ Telegram (${tg.enabled ? 'ເປີດ' : 'ປິດ'})`);
    return send(res, 200, { enabled: tg.enabled, chatId: tg.chatId, hasToken: !!tg.botToken });
  }
  if (p === '/api/admin/notify/test' && m === 'POST') {
    requireAuth(req, url, ['owner']);
    const tg = db().private.telegram || {};
    if (!tg.botToken || !tg.chatId) throw new HttpError(400, 'ກະລຸນາໃສ່ Bot Token ແລະ Chat ID ກ່ອນ');
    const r = await notifyTelegram(`✅ ທົດສອບແຈ້ງເຕືອນຈາກ ${db().docs.hotelInfo?.name || 'ຣີສອດ'} — ເຊື່ອມຕໍ່ສຳເລັດ!`);
    if (!r.ok) throw new HttpError(502, `ສົ່ງບໍ່ສຳເລັດ: ${r.error || (r.skipped ? 'ຍັງບໍ່ໄດ້ເປີດໃຊ້ງານ' : 'unknown')}`);
    return send(res, 200, { ok: true });
  }

  // ================== PUBLIC (ລູກຄ້າ — ບໍ່ຕ້ອງ login) ==================
  if (p === '/api/public/catalog' && m === 'GET') {
    return send(res, 200, publicCatalog());
  }

  if (p === '/api/public/bookings' && m === 'POST') {
    rateLimit(req, 'pub-booking', 10, 10 * 60000);
    const body = await readBody(req, 256 * 1024);
    const room = db().collections.rooms.find(r => r.id === body.roomId);
    if (!room) throw new HttpError(404, 'ບໍ່ພົບຫ້ອງ');
    if (room.status === 'maintenance') throw new HttpError(409, 'ຫ້ອງນີ້ປິດສ້ອມແປງ');
    const checkIn = body.checkIn; const checkOut = body.checkOut;
    if (!isDate(checkIn) || !isDate(checkOut) || checkIn >= checkOut) throw new HttpError(400, 'ວັນທີບໍ່ຖືກຕ້ອງ');
    if (checkIn < todayLocal()) throw new HttpError(400, 'ບໍ່ສາມາດຈອງວັນທີຜ່ານມາແລ້ວ');
    const guestName = str(body.guestName, 120); const guestPhone = str(body.guestPhone, 40);
    if (!guestName || !guestPhone) throw new HttpError(400, 'ກະລຸນາໃສ່ຊື່ ແລະ ເບີໂທ');
    const conflict = db().collections.bookings.some(b =>
      b.roomId === room.id && BLOCKING_STATUSES.includes(b.status) && b.checkIn < checkOut && b.checkOut > checkIn);
    if (conflict) throw new HttpError(409, 'ຂໍອະໄພ ຫ້ອງນີ້ຖືກຈອງໃນວັນທີທີ່ເລືອກແລ້ວ ກະລຸນາເລືອກວັນ ຫຼື ຫ້ອງອື່ນ');

    const price = computeStayPrice(room, checkIn, checkOut, db().collections.ratePlans);
    if (price.nights > 60) throw new HttpError(400, 'ຈອງອອນລາຍໄດ້ສູງສຸດ 60 ຄືນ');
    let id = generateBookingId();
    while (db().collections.bookings.some(b => b.id === id)) id = generateBookingId();
    const booking = {
      id,
      publicToken: generatePublicToken(),
      roomId: room.id,
      checkIn, checkOut,
      nights: price.nights,
      roomPrice: room.price,
      nightlyRates: price.hasAdjustment ? price.nightly.map(n => ({ date: n.date, price: n.price, plan: n.plan?.name || null })) : undefined,
      totalAmount: price.total,
      remainingAmount: price.total,
      discount: 0,
      deposit: 0,
      guestName, guestPhone,
      guestNationality: str(body.guestNationality, 60),
      guestCount: Math.max(1, Math.min(20, Number(body.guestCount) || 1)),
      passportNo: str(body.passportNo, 40).toUpperCase(),
      dob: isDate(body.dob) ? body.dob : '',
      email: str(body.email, 120),
      address: str(body.address, 300),
      notes: str(body.notes, 1000),
      paymentMethod: ['cash', 'transfer', 'qr', 'card'].includes(body.paymentMethod) ? body.paymentMethod : 'cash',
      status: 'pending',
      bookingChannel: 'online',
      createdAt: new Date().toISOString(),
      checkedInAt: null,
      checkedOutAt: null,
      extraCharges: [],
      payments: [],
    };
    store.applyOps('bookings', [{ op: 'upsert', item: booking, index: 0 }]);
    broadcast({ type: 'ops', coll: 'bookings', ops: [{ op: 'upsert', item: booking, index: 0 }] });
    audit(null, 'booking.online', `ລູກຄ້າຈອງອອນລາຍ ${id}: ຫ້ອງ ${room.number} ວັນທີ ${checkIn} ຫາ ${checkOut} (${guestName})`);
    broadcast({ type: 'notify', kind: 'online_booking', id, title: `🌐 ການຈອງອອນລາຍໃໝ່ ${id}`, message: `${guestName} • ຫ້ອງ ${room.number} • ${checkIn} → ${checkOut}` });
    notifyTelegram(
      `🌐 ການຈອງອອນລາຍໃໝ່ (ລໍຢືນຢັນ)\n` +
      `ລະຫັດ: ${id}\nຊື່: ${guestName}\nເບີໂທ: ${guestPhone}\n` +
      `ຫ້ອງ: ${room.number} (${room.type})\nວັນທີ: ${checkIn} → ${checkOut} (${price.nights} ຄືນ)\n` +
      `ຍອດ: ${fmtKip(price.total)}${booking.notes ? `\nໝາຍເຫດ: ${booking.notes}` : ''}`
    );
    return send(res, 200, { booking: publicBookingView(booking) });
  }

  if (p === '/api/public/activity-bookings' && m === 'POST') {
    rateLimit(req, 'pub-activity', 10, 10 * 60000);
    const body = await readBody(req, 64 * 1024);
    const act = db().collections.guestActivities.find(a => a.id === body.activityId);
    if (!act || !act.price) throw new HttpError(404, 'ບໍ່ພົບກິດຈະກຳ');
    const guestName = str(body.guestName, 120); const guestPhone = str(body.guestPhone, 40);
    if (!guestName || !guestPhone) throw new HttpError(400, 'ກະລຸນາໃສ່ຊື່ ແລະ ເບີໂທ');
    const date = isDate(body.date) ? body.date : todayLocal();
    if (date < todayLocal()) throw new HttpError(400, 'ບໍ່ສາມາດຈອງວັນທີຜ່ານມາແລ້ວ');
    const quantity = Math.max(1, Math.min(50, Number(body.quantity) || 1));
    const sale = {
      id: newId('AC'),
      activityId: act.id,
      activityLabel: str(body.activityLabel, 100) || act.label,
      price: act.price,
      quantity,
      totalAmount: act.price * quantity,
      guestName, customerName: guestName, guestPhone,
      guestNationality: str(body.guestNationality, 60),
      paymentMethod: ['cash', 'transfer', 'qr', 'card'].includes(body.paymentMethod) ? body.paymentMethod : 'cash',
      date,
      notes: str(body.notes, 1000),
      status: 'booked',
      channel: 'online',
      createdAt: new Date().toISOString(),
    };
    store.applyOps('activitySales', [{ op: 'upsert', item: sale, index: 0 }]);
    broadcast({ type: 'ops', coll: 'activitySales', ops: [{ op: 'upsert', item: sale, index: 0 }] });
    audit(null, 'activity.online', `ລູກຄ້າຈອງກິດຈະກຳ "${sale.activityLabel}" ${quantity} ປີ້ ວັນທີ ${date} (${guestName})`);
    broadcast({ type: 'notify', kind: 'online_activity', id: sale.id, title: '🎟️ ຈອງກິດຈະກຳອອນລາຍໃໝ່', message: `${guestName} • ${sale.activityLabel} × ${quantity} • ${date}` });
    notifyTelegram(`🎟️ ຈອງກິດຈະກຳອອນລາຍໃໝ່\nກິດຈະກຳ: ${sale.activityLabel} × ${quantity}\nວັນທີ: ${date}\nຊື່: ${guestName}\nເບີໂທ: ${guestPhone}\nຍອດ: ${fmtKip(sale.totalAmount)}`);
    return send(res, 200, { sale });
  }

  const pubBooking = p.match(/^\/api\/public\/bookings\/([^/]+)(\/signature)?$/);
  if (pubBooking) {
    rateLimit(req, 'pub-view', 120, 10 * 60000);
    const id = decodeURIComponent(pubBooking[1]);
    const b = db().collections.bookings.find(x => x.id === id);
    const t = url.searchParams.get('t');
    if (!b || !b.publicToken || !safeEqual(b.publicToken, t)) throw new HttpError(404, 'ບໍ່ພົບການຈອງ ຫຼື ລິ້ງບໍ່ຖືກຕ້ອງ');
    if (!pubBooking[2] && m === 'GET') return send(res, 200, { booking: publicBookingView(b) });
    if (pubBooking[2] && m === 'POST') {
      const body = await readBody(req, 2 * 1024 * 1024);
      const sig = String(body.signatureDataUrl || '');
      if (sig && !/^data:image\/(png|jpeg|webp);base64,/.test(sig)) throw new HttpError(400, 'ລາຍເຊັນບໍ່ຖືກຕ້ອງ');
      if (sig.length > 1500000) throw new HttpError(413, 'ຮູບລາຍເຊັນໃຫຍ່ເກີນໄປ');
      const updated = { ...b, signatureDataUrl: sig, signedAt: sig ? new Date().toISOString() : '', updatedAt: new Date().toISOString() };
      store.applyOps('bookings', [{ op: 'upsert', item: updated }]);
      broadcast({ type: 'ops', coll: 'bookings', ops: [{ op: 'upsert', item: updated }] });
      if (sig) audit(null, 'booking.signed', `ລູກຄ້າເຊັນຢືນຢັນການຈອງ ${b.id} ຜ່ານມືຖື`);
      return send(res, 200, { booking: publicBookingView(updated) });
    }
  }

  throw new HttpError(404, 'Not found');
}

const loginAttempts = new Map();

// ================== STATIC FILES ==================
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(req, res, url) {
  if (!fs.existsSync(DIST)) {
    res.writeHead(503, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('ຍັງບໍ່ໄດ້ build ໜ້າເວັບ — ກະລຸນາແລ່ນ: npm run build');
  }
  let rel = decodeURIComponent(url.pathname);
  let file = path.normalize(path.join(DIST, rel));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
  const ext = path.extname(file).toLowerCase();
  const isAsset = rel.startsWith('/assets/');
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(file).pipe(res);
}

// ================== SERVER ==================
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url);
    } else if (req.method === 'GET' || req.method === 'HEAD') {
      serveStatic(req, res, url);
    } else {
      throw new HttpError(405, 'Method not allowed');
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    if (status === 500) console.error('[error]', req.method, url.pathname, e);
    if (!res.headersSent) send(res, status, { error: status === 500 ? 'ເກີດຂໍ້ຜິດພາດໃນ server' : e.message });
    else res.end();
  }
});

server.listen(PORT, '0.0.0.0', () => {
  const ips = Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal).map(i => i.address);
  console.log('');
  console.log('🏨  Tad Fane Resort server ກຳລັງເຮັດວຽກ');
  console.log(`    ເຄື່ອງນີ້:      http://localhost:${PORT}`);
  ips.forEach(ip => console.log(`    ໃນ Wi-Fi:      http://${ip}:${PORT}`));
  console.log(`    ໜ້າຈອງລູກຄ້າ: http://${ips[0] || 'localhost'}:${PORT}/?guest=true`);
  console.log(`    ຂໍ້ມູນ:         ${store.file}`);
  console.log('');
});

function shutdown() {
  try { store.flush(); } catch (e) { console.error(e); }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
