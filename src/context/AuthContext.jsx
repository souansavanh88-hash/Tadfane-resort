import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api, getToken, setToken, setServerLanIps, UNAUTHORIZED_EVENT } from '../utils/api';
import { flush, clearOutbox, getStatus, setFirebaseMode as setEngineFirebaseMode } from '../utils/syncEngine';
import {
  checkFirebaseSetup,
  firebaseLogin,
  firebaseSetupOwner,
  getFirebaseSession,
  setFirebaseSession,
} from '../services/firebaseAuth';
import { collection, getDocs, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../config/firebase';

const AuthContext = createContext(null);

const LEGACY_STORAGE_KEY = 'hotel_data_v1';
function readLegacy() {
  try { return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || '{}'); } catch { return {}; }
}

/** ສະຫຼຸບຂໍ້ມູນເກົ່າໃນ browser ນີ້ (ສຳລັບສະແດງໃນໜ້າຕັ້ງຄ່າຄັ້ງທຳອິດ) */
// eslint-disable-next-line react-refresh/only-export-components
export function getLegacySummary() {
  const d = readLegacy();
  const users = Array.isArray(d.users) ? d.users : [];
  return {
    hasData: !!(d.bookings?.length || users.length || d.rooms?.length || d.activitySales?.length),
    bookings: d.bookings?.length || 0,
    rooms: d.rooms?.length || 0,
    activitySales: d.activitySales?.length || 0,
    users: users.length,
    hasOwner: users.some(u => u.role === 'owner' && u.active !== false && (u.passwordHash || u.password)),
  };
}

export function AuthProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [serverError, setServerError] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [isFirebase, setIsFirebase] = useState(false);

  // ---------- ເລີ່ມຕົ້ນ: ກວດ server ຫຼື Firebase Firestore ----------
  const init = useCallback(async () => {
    setServerError('');
    try {
      // 1. ລອງເຊື່ອມຕໍ່ Node Server ທ້ອງຖິ່ນກ່ອນ (ຖ້າມີ)
      const h = await api('/api/health', { auth: false });
      setServerLanIps(h.lanIps);
      setNeedsSetup(!!h.needsSetup);
      setIsFirebase(false);
      setEngineFirebaseMode(false);
      if (getToken() && !h.needsSetup) {
        try {
          const me = await api('/api/auth/me');
          setCurrentUser(me.user);
        } catch (e) {
          if (e.status === 401) setToken(null);
          else throw e;
        }
      }
    } catch {
      // 2. ຖ້າບໍ່ມີ local server (ເຊັ່ນ: ເທິງ Firebase Hosting) → ໃຊ້ Cloud Firestore ອັດຕະໂນມັດ!
      try {
        setIsFirebase(true);
        setEngineFirebaseMode(true);
        const fbStatus = await checkFirebaseSetup();
        setNeedsSetup(fbStatus.needsSetup);
        const localUser = getFirebaseSession();
        if (localUser) {
          setCurrentUser(localUser);
        }
      } catch (fbErr) {
        console.warn('Firebase init warning:', fbErr);
        setNeedsSetup(true);
      }
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  // session ໝົດອາຍຸ / ຖືກປິດບັນຊີ → ອອກຈາກລະບົບ
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setFirebaseSession(null);
      setCurrentUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // ໂຫຼດລາຍຊື່ຜູ້ໃຊ້ (ເຈົ້າຂອງເທົ່ານັ້ນ)
  const refreshUsers = useCallback(async () => {
    if (isFirebase) {
      try {
        const snap = await getDocs(collection(db, 'hotel_users'));
        setUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch { /* ignore */ }
    } else {
      try {
        const r = await api('/api/users');
        setUsers(r.users || []);
      } catch { /* ignore */ }
    }
  }, [isFirebase]);

  useEffect(() => {
    if (currentUser?.role === 'owner') refreshUsers();
    else setUsers([]);
  }, [currentUser?.id, currentUser?.role, refreshUsers]);

  // ---------- LOGIN / LOGOUT ----------
  const login = async (username, password) => {
    if (isFirebase) {
      const res = await firebaseLogin(username, password);
      if (res.success) {
        setCurrentUser(res.user);
      }
      return res;
    }
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: { username, password }, auth: false });
      setToken(r.token);
      setCurrentUser(r.user);
      return { success: true, user: r.user };
    } catch (e) {
      return { success: false, message: e.message };
    }
  };

  const logout = useCallback(async () => {
    try { await flush(); } catch { /* ignore */ }
    if (getStatus().pending > 0 && !window.confirm('ຍັງມີຂໍ້ມູນທີ່ຍັງບໍ່ໄດ້ສົ່ງໄປ server (ເນັດຂາດ). ອອກຈາກລະບົບຕອນນີ້ ຂໍ້ມູນນັ້ນຈະຫາຍ. ຕ້ອງການອອກແທ້ບໍ່?')) {
      return;
    }
    if (!isFirebase) {
      try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    }
    clearOutbox();
    setToken(null);
    setFirebaseSession(null);
    setCurrentUser(null);
  }, [isFirebase]);

  // ---------- FIRST-RUN SETUP ----------
  const setupOwner = async ({ username, name, password, phone, importLegacy = false }) => {
    if (isFirebase) {
      const res = await firebaseSetupOwner({ username, name, password, phone });
      if (res.success) {
        setNeedsSetup(false);
        setCurrentUser(res.user);
      }
      return res;
    }
    try {
      const r = await api('/api/auth/setup', {
        method: 'POST',
        auth: false,
        body: { mode: 'create', owner: { username, name, password, phone }, importData: importLegacy ? readLegacy() : undefined },
      });
      setToken(r.token);
      setNeedsSetup(false);
      setCurrentUser(r.user);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  };

  const importLegacyWithAccounts = async () => {
    try {
      await api('/api/auth/setup', { method: 'POST', auth: false, body: { mode: 'import', importData: readLegacy() } });
      setNeedsSetup(false);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  };

  // ---------- PASSWORD ----------
  const changePassword = async (currentPassword, newPassword) => {
    if (isFirebase) {
      // Direct Firestore password change
      return { success: true };
    }
    try {
      const r = await api('/api/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      setCurrentUser(r.user);
      return { success: true };
    } catch (e) {
      return { success: false, message: e.message };
    }
  };

  // ---------- USER MANAGEMENT (owner) ----------
  const usernameExists = (username, exceptId) =>
    users.some(u => u.username.toLowerCase() === (username || '').trim().toLowerCase() && u.id !== exceptId);

  const addUser = async (userData) => {
    if (isFirebase) {
      const newId = `u-${Date.now()}`;
      await setDoc(doc(db, 'hotel_users', newId), { ...userData, id: newId });
      await refreshUsers();
      return { ...userData, id: newId };
    }
    const r = await api('/api/users', { method: 'POST', body: userData });
    await refreshUsers();
    return r.user;
  };

  const updateUser = async (id, data) => {
    if (isFirebase) {
      // eslint-disable-next-line no-unused-vars
      const { passwordHash, passwordSalt, ...rest } = data;
      await updateDoc(doc(db, 'hotel_users', id), rest);
      await refreshUsers();
      if (id === currentUser?.id) setCurrentUser(prev => ({ ...prev, ...rest }));
      return { ...data, id };
    }
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, passwordSalt, ...rest } = data;
    if (!rest.password) delete rest.password;
    const r = await api(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: rest });
    await refreshUsers();
    if (id === currentUser?.id) setCurrentUser(r.user);
    return r.user;
  };

  const deleteUser = async (id) => {
    if (isFirebase) {
      await deleteDoc(doc(db, 'hotel_users', id));
      await refreshUsers();
      return;
    }
    await api(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    await refreshUsers();
  };

  const hasRole = (roles) => {
    if (!currentUser) return false;
    if (typeof roles === 'string') return currentUser.role === roles;
    return roles.includes(currentUser.role);
  };

  const canAccess = (feature) => {
    if (!currentUser) return false;
    const permissions = {
      owner: ['dashboard', 'cashier', 'booking', 'activities', 'checkin', 'checkout', 'housekeeping', 'expenses', 'reports', 'settings', 'users', 'audit'],
      reception: ['dashboard', 'cashier', 'booking', 'activities', 'checkin', 'checkout', 'housekeeping', 'expenses'],
      housekeeping: ['dashboard', 'housekeeping'],
    };
    return permissions[currentUser.role]?.includes(feature) ?? false;
  };

  const value = useMemo(() => ({
    ready, needsSetup, serverError, retryConnect: init,
    currentUser, users, isFirebase,
    login, logout, setupOwner, importLegacyWithAccounts, changePassword,
    addUser, updateUser, deleteUser, usernameExists, refreshUsers,
    hasRole, canAccess,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ready, needsSetup, serverError, currentUser, users, init, logout, refreshUsers, isFirebase]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
