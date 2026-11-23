// Integration test ສຳລັບ server — ແລ່ນ: node server/selftest.js
// ເປີດ server ຊົ່ວຄາວ (ຂໍ້ມູນໃນ temp folder) ແລ້ວທົດສອບ API ຫຼັກໆ
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 18000 + Math.floor(Math.random() * 1000);
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'tadfane-test-'));
const B = `http://127.0.0.1:${PORT}`;

let failed = 0;
const ok = (cond, msg) => { console.log(`${cond ? '✅' : '❌'} ${msg}`); if (!cond) failed++; };

async function j(p, { method = 'GET', body, token } = {}) {
  const r = await fetch(B + p, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await r.json(); } catch { /* */ }
  return { status: r.status, data };
}

const child = spawn(process.execPath, [path.join(__dirname, 'index.js')], {
  env: { ...process.env, PORT: String(PORT), DATA_DIR },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stderr.on('data', d => process.stderr.write(d));

async function waitUp() {
  for (let i = 0; i < 50; i++) {
    try { await fetch(`${B}/api/health`); return; } catch { await new Promise(r => setTimeout(r, 100)); }
  }
  throw new Error('server did not start');
}

const pad = (n) => String(n).padStart(2, '0');
const d = (offset) => { const x = new Date(); x.setDate(x.getDate() + offset); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };

try {
  await waitUp();
  let r = await j('/api/health');
  ok(r.status === 200 && r.data.needsSetup === true, 'health: needsSetup=true on fresh db');

  r = await j('/api/auth/setup', { method: 'POST', body: { mode: 'create', owner: { username: 'admin', name: 'Owner', password: 'weak' } } });
  ok(r.status === 400, 'setup rejects weak password');

  r = await j('/api/auth/setup', { method: 'POST', body: { mode: 'create', owner: { username: 'admin', name: 'Owner', password: 'Secret123' } } });
  ok(r.status === 200 && r.data.token, 'setup creates owner + token');
  const owner = r.data.token;

  r = await j('/api/auth/setup', { method: 'POST', body: { mode: 'create', owner: { username: 'x', name: 'x', password: 'Secret123' } } });
  ok(r.status === 409, 'setup cannot run twice');

  r = await j('/api/state', { token: owner });
  ok(r.status === 200 && r.data.collections.rooms.length > 0 && r.data.collections.guestActivities.length > 0, 'state has seeded rooms + activities');
  const roomId = r.data.collections.rooms[0].id;

  r = await j('/api/state');
  ok(r.status === 401, 'state requires auth');

  r = await j('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'nope' } });
  ok(r.status === 401, 'login wrong password → 401');
  r = await j('/api/auth/login', { method: 'POST', body: { username: 'ADMIN', password: 'Secret123' } });
  ok(r.status === 200 && r.data.token, 'login ok (case-insensitive username)');

  // users
  r = await j('/api/users', { method: 'POST', token: owner, body: { username: 'rec1', name: 'Reception', password: 'Recept123', role: 'reception' } });
  ok(r.status === 200, 'owner creates reception user');
  const recId = r.data.user.id;
  r = await j('/api/auth/login', { method: 'POST', body: { username: 'rec1', password: 'Recept123' } });
  const rec = r.data.token;
  ok(!!rec, 'reception login');
  r = await j('/api/users', { token: rec });
  ok(r.status === 403, 'reception cannot list users');
  r = await j('/api/state', { token: rec });
  ok(r.status === 200 && !r.data.collections.auditLog, 'reception state excludes auditLog');

  // sync permissions
  r = await j('/api/sync', { method: 'POST', token: rec, body: { clientId: 't', batch: [
    { type: 'ops', coll: 'expenses', ops: [{ op: 'upsert', item: { id: 'EX-1', amount: 5000, date: d(0) } }] },
    { type: 'ops', coll: 'ratePlans', ops: [{ op: 'upsert', item: { id: 'RP-x' } }] },
    { type: 'ops', coll: 'auditLog', ops: [{ op: 'upsert', item: { id: 'fake' } }] },
    { type: 'doc', name: 'hotelInfo', value: { name: 'hacked' } },
    { type: 'audit', entry: { action: 'test.action', details: 'hello' } },
  ] } });
  ok(r.status === 200 && r.data.rejected === 3, `reception sync: 3 rejected (got ${r.data?.rejected})`);

  // rate plan by owner (weekend +50%)
  r = await j('/api/sync', { method: 'POST', token: owner, body: { clientId: 't', batch: [
    { type: 'ops', coll: 'ratePlans', ops: [{ op: 'upsert', item: { id: 'RP-1', name: 'All +50%', active: true, adjustType: 'percent', value: 50 } }] },
  ] } });
  ok(r.data.rejected === 0, 'owner can write ratePlans');

  r = await j('/api/state', { token: owner });
  ok(r.data.collections.expenses.length === 1, 'expense stored');
  ok(r.data.collections.auditLog.some(a => a.action === 'test.action' && a.username === 'rec1'), 'audit stamped with real user by server');
  ok(!r.data.collections.auditLog.some(a => a.id === 'fake'), 'fake audit rejected');
  const roomPrice = r.data.collections.rooms[0].price;

  // public booking
  r = await j('/api/public/bookings', { method: 'POST', body: { roomId, checkIn: d(10), checkOut: d(12), guestName: 'Guest A', guestPhone: '020', totalAmount: 1 } });
  ok(r.status === 200 && r.data.booking.status === 'pending', 'public booking created (pending)');
  const pb = r.data.booking;
  ok(pb.totalAmount === Math.round(roomPrice * 1.5 / 1000) * 1000 * 2, `server-side price uses rate plan (got ${pb.totalAmount})`);
  r = await j('/api/public/bookings', { method: 'POST', body: { roomId, checkIn: d(11), checkOut: d(13), guestName: 'Guest B', guestPhone: '020' } });
  ok(r.status === 409, 'double booking rejected');
  r = await j('/api/public/bookings', { method: 'POST', body: { roomId, checkIn: d(-3), checkOut: d(-1), guestName: 'Guest C', guestPhone: '020' } });
  ok(r.status === 400, 'past date rejected');

  r = await j(`/api/public/bookings/${pb.id}?t=wrong`);
  ok(r.status === 404, 'public booking view needs correct token');
  r = await j(`/api/public/bookings/${pb.id}?t=${pb.publicToken}`);
  ok(r.status === 200 && r.data.booking.id === pb.id, 'public booking view with token');
  r = await j(`/api/public/bookings/${pb.id}/signature?t=${pb.publicToken}`, { method: 'POST', body: { signatureDataUrl: 'data:image/png;base64,AAAA' } });
  ok(r.status === 200 && r.data.booking.signedAt, 'guest signature saved');

  r = await j('/api/public/catalog');
  ok(r.status === 200 && r.data.busy.length === 1 && !('guestName' in r.data.busy[0]), 'catalog busy ranges without guest data');

  r = await j('/api/public/activity-bookings', { method: 'POST', body: { activityId: 'zipline', quantity: 2, guestName: 'G', guestPhone: '1', date: d(1) } });
  ok(r.status === 200 && r.data.sale.totalAmount === 240000, 'public activity booking priced server-side');

  // deactivate user kills session
  r = await j(`/api/users/${recId}`, { method: 'PATCH', token: owner, body: { active: false } });
  r = await j('/api/state', { token: rec });
  ok(r.status === 401, 'deactivated user session revoked');

  // last owner protection
  r = await j('/api/users', { token: owner });
  const ownerId = r.data.users.find(u => u.username === 'admin').id;
  r = await j(`/api/users/${ownerId}`, { method: 'PATCH', token: owner, body: { role: 'reception' } });
  ok(r.status === 400, 'cannot demote last owner');

  // backup / restore
  r = await j('/api/admin/backup', { token: owner });
  ok(r.status === 200 && r.data.format === 'tadfane-backup', 'backup download');
  const backup = r.data;
  await j('/api/sync', { method: 'POST', token: owner, body: { clientId: 't', batch: [{ type: 'ops', coll: 'expenses', ops: [{ op: 'delete', id: 'EX-1' }] }] } });
  r = await j('/api/admin/restore', { method: 'POST', token: owner, body: { backup } });
  ok(r.status === 200, 'restore ok');
  r = await j('/api/state', { token: owner });
  ok(r.data.collections.expenses.length === 1, 'restore brought back deleted expense');

  // lockout
  for (let i = 0; i < 5; i++) await j('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'bad' } });
  r = await j('/api/auth/login', { method: 'POST', body: { username: 'admin', password: 'Secret123' } });
  ok(r.status === 423, 'account locked after 5 bad attempts');

  r = await fetch(`${B}/`);
  ok(r.status === 200 || r.status === 503, `static root served (${r.status})`);
} catch (e) {
  console.error('❌ test crashed:', e);
  failed++;
} finally {
  child.kill('SIGTERM');
  setTimeout(() => {
    fs.rmSync(DATA_DIR, { recursive: true, force: true });
    console.log(failed ? `\n${failed} test(s) failed` : '\nAll server tests passed 🎉');
    process.exit(failed ? 1 : 0);
  }, 300);
}
