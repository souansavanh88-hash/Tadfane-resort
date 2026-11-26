// ================== Sync engine: ເຊື່ອມຂໍ້ມູນລະຫວ່າງເຄື່ອງ (Server + Cloud Firestore) ==================
import { api, getToken, CLIENT_ID } from './api';
import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config/firebase';

const OUTBOX_KEY = 'hotel_outbox';
const BATCH = 25;

const FIRESTORE_MAP = {
  rooms: 'hotel_rooms',
  bookings: 'hotel_bookings',
  activitySales: 'hotel_activity_sales',
  guestActivities: 'hotel_activities',
  shiftCloses: 'hotel_shift_closes',
  expenses: 'hotel_expenses',
  maintenanceLogs: 'hotel_maintenance',
  ratePlans: 'hotel_rate_plans',
  auditLog: 'hotel_audit_log',
};

const listeners = new Map();
const globalListeners = new Set();

let state = { collections: {}, docs: {} };
let loaded = false;
let outbox = loadOutbox();
let flushing = false;
let retryTimer = null;
let es = null;
let reconnectTimer = null;
let status = 'idle';
let running = false;
let isFirebaseMode = false;
let fbUnsubscribers = [];

export function setFirebaseMode(val) {
  isFirebaseMode = !!val;
}
export const isFirebase = () => isFirebaseMode;

function loadOutbox() {
  try { return JSON.parse(localStorage.getItem(OUTBOX_KEY) || '[]'); } catch { return []; }
}
function saveOutbox() {
  try { localStorage.setItem(OUTBOX_KEY, JSON.stringify(outbox)); } catch { /* ignore */ }
}

function emit(key, kind, payload) {
  const set = listeners.get(key);
  if (set) set.forEach(fn => fn(kind, payload));
}
function emitGlobal(msg) {
  globalListeners.forEach(fn => fn(msg));
}
function setStatus(s) {
  if (status === s) return;
  status = s;
  emitGlobal({ type: 'status' });
}

export function subscribe(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key)?.delete(fn);
}
export function onGlobal(fn) {
  globalListeners.add(fn);
  return () => globalListeners.delete(fn);
}

export const isLoaded = () => loaded;
export const getStatus = () => ({ status, pending: outbox.length, loaded });
export const getCollection = (name) => state.collections[name];
export const getDoc = (name) => state.docs[name];

// ---------- ops helpers ----------
export function applyOps(list, ops) {
  const next = Array.isArray(list) ? list.slice() : [];
  for (const o of ops) {
    if (o.op === 'upsert' && o.item) {
      const i = next.findIndex(x => x.id === o.item.id);
      if (i >= 0) next[i] = o.item;
      else {
        const idx = Number.isInteger(o.index) ? Math.min(Math.max(0, o.index), next.length) : 0;
        next.splice(idx, 0, o.item);
      }
    } else if (o.op === 'delete') {
      const i = next.findIndex(x => x.id === o.id);
      if (i >= 0) next.splice(i, 1);
    }
  }
  return next;
}

export function diffById(prev, next) {
  const prevMap = new Map((prev || []).map(x => [x?.id, x]));
  const ops = [];
  (next || []).forEach((item, index) => {
    if (item == null || item.id == null) return;
    const old = prevMap.get(item.id);
    prevMap.delete(item.id);
    if (old === item) return;
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) ops.push({ op: 'upsert', item, index });
  });
  for (const id of prevMap.keys()) if (id != null) ops.push({ op: 'delete', id });
  return ops;
}

// ---------- push (local → server / Firestore) ----------
function enqueue(item) {
  outbox.push(item);
  saveOutbox();
  emitGlobal({ type: 'status' });
  flush();
}

export function pushOps(coll, ops) {
  if (!ops.length) return;
  state.collections[coll] = applyOps(state.collections[coll] || [], ops);
  if (isFirebaseMode) {
    const fsColl = FIRESTORE_MAP[coll] || coll;
    for (const o of ops) {
      try {
        if (o.op === 'upsert' && o.item && o.item.id != null) {
          setDoc(doc(db, fsColl, String(o.item.id)), o.item, { merge: true }).catch(console.warn);
        } else if (o.op === 'delete' && o.id != null) {
          deleteDoc(doc(db, fsColl, String(o.id))).catch(console.warn);
        }
      } catch (err) {
        console.warn('Firestore pushOps error:', err);
      }
    }
    return;
  }
  enqueue({ type: 'ops', coll, ops });
}

export function pushDoc(name, value) {
  state.docs[name] = value;
  if (isFirebaseMode) {
    if (name === 'hotelInfo') {
      setDoc(doc(db, 'hotel_info', 'general'), value, { merge: true }).catch(console.warn);
    }
    return;
  }
  enqueue({ type: 'doc', name, value });
}

export function pushAudit(entry) {
  if (isFirebaseMode) {
    const id = `audit-${Date.now()}`;
    setDoc(doc(db, 'hotel_audit_log', id), { id, ...entry }, { merge: true }).catch(console.warn);
    return;
  }
  if (!getToken()) return;
  enqueue({ type: 'audit', entry });
}

function scheduleRetry() {
  if (retryTimer) return;
  retryTimer = setTimeout(() => { retryTimer = null; flush(); }, 4000);
}

export async function flush() {
  if (isFirebaseMode) return; // Firestore SDK handles its own offline queue
  if (flushing || !getToken() || outbox.length === 0) return;
  flushing = true;
  try {
    while (outbox.length) {
      const batch = outbox.slice(0, BATCH);
      const res = await api('/api/sync', { method: 'POST', body: { clientId: CLIENT_ID, batch } });
      outbox.splice(0, batch.length);
      saveOutbox();
      if (res?.rejected) {
        emitGlobal({ type: 'error', message: `ການປ່ຽນແປງ ${res.rejected} ລາຍການ ບໍ່ໄດ້ບັນທຶກ ເພາະທ່ານບໍ່ມີສິດ` });
        await reload().catch(() => {});
      }
    }
    if (running && es && es.readyState === 1) setStatus('online');
  } catch (e) {
    if (e.status === 0 || e.status >= 500) {
      setStatus('offline');
      scheduleRetry();
    } else if (e.status !== 401) {
      outbox.splice(0, Math.min(BATCH, outbox.length));
      saveOutbox();
      emitGlobal({ type: 'error', message: e.message });
      reload().catch(() => {});
    }
  } finally {
    flushing = false;
    emitGlobal({ type: 'status' });
  }
}

// ---------- Firestore Listeners ----------
function startFirebaseListeners() {
  fbUnsubscribers.forEach(un => un());
  fbUnsubscribers = [];

  // 1. Subscribe to all collections
  for (const [key, collName] of Object.entries(FIRESTORE_MAP)) {
    const un = onSnapshot(collection(db, collName), (snapshot) => {
      const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      state.collections[key] = items;
      emit(key, 'replace', items);
    }, (err) => console.warn(`Firestore collection error [${collName}]:`, err));
    fbUnsubscribers.push(un);
  }

  // 2. Subscribe to hotelInfo doc
  const unDoc = onSnapshot(doc(db, 'hotel_info', 'general'), (snap) => {
    if (snap.exists()) {
      state.docs.hotelInfo = snap.data();
      emit('doc:hotelInfo', 'replace', snap.data());
    }
  }, (err) => console.warn('Firestore doc error [hotel_info]:', err));
  fbUnsubscribers.push(unDoc);

  loaded = true;
  setStatus('online');
}

// ---------- load / reload ----------
function replaceAll(next) {
  state = next;
  loaded = true;
  for (const key of listeners.keys()) {
    if (key.startsWith('doc:')) emit(key, 'replace', state.docs[key.slice(4)]);
    else emit(key, 'replace', state.collections[key] || []);
  }
  emitGlobal({ type: 'status' });
}

export async function reload() {
  if (isFirebaseMode) return;
  const s = await api('/api/state');
  for (const it of outbox) {
    if (it.type === 'ops' && s.collections[it.coll]) s.collections[it.coll] = applyOps(s.collections[it.coll], it.ops);
    if (it.type === 'doc') s.docs[it.name] = it.value;
  }
  replaceAll({ collections: s.collections || {}, docs: s.docs || {} });
}

function handleMessage(msg) {
  if (msg.type === 'ops' && msg.coll) {
    state.collections[msg.coll] = applyOps(state.collections[msg.coll] || [], msg.ops || []);
    emit(msg.coll, 'ops', msg.ops || []);
  } else if (msg.type === 'doc' && msg.name) {
    state.docs[msg.name] = msg.value;
    emit(`doc:${msg.name}`, 'replace', msg.value);
  } else if (msg.type === 'reload') {
    reload().catch(() => {});
  } else if (msg.type === 'notify') {
    emitGlobal(msg);
  }
}

function connectEvents() {
  if (!running || !getToken()) return;
  if (es) es.close();
  let hadError = false;
  es = new EventSource(`/api/events?token=${encodeURIComponent(getToken())}&clientId=${encodeURIComponent(CLIENT_ID)}`);
  es.onopen = () => {
    setStatus('online');
    if (hadError) {
      hadError = false;
      reload().catch(() => {});
      flush();
    }
  };
  es.onerror = () => {
    hadError = true;
    setStatus('offline');
    if (es && es.readyState === 2) {
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(async () => {
        try { await api('/api/auth/me'); } catch { /* ignore */ }
        connectEvents();
      }, 5000);
    }
  };
  es.onmessage = (ev) => {
    try { handleMessage(JSON.parse(ev.data)); } catch { /* ignore */ }
  };
}

export async function start() {
  running = true;
  if (isFirebaseMode) {
    startFirebaseListeners();
    return;
  }
  setStatus('connecting');
  await reload();
  connectEvents();
  flush();
}

export function stop() {
  running = false;
  fbUnsubscribers.forEach(un => un());
  fbUnsubscribers = [];
  if (es) { es.close(); es = null; }
  clearTimeout(reconnectTimer);
  clearTimeout(retryTimer);
  retryTimer = null;
  loaded = false;
  state = { collections: {}, docs: {} };
  setStatus('idle');
}

export function clearOutbox() {
  outbox = [];
  saveOutbox();
}

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => flush());
}
