import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { api, getToken, setToken, setServerLanIps, UNAUTHORIZED_EVENT } from '../utils/api';
import { flush, clearOutbox, getStatus } from '../utils/syncEngine';

const AuthContext = createContext(null);

// ---------- ຂໍ້ມູນເກົ່າທີ່ເກັບໃນ browser (ລຸ້ນກ່ອນມີ server) ----------
const LEGACY_KEYS = {
  users: 'hotel_users',
  rooms: 'hotel_rooms',
  bookings: 'hotel_bookings',
  hotelInfo: 'hotel_info',
  guestActivities: 'guest_activities',
  activitySales: 'activities_sales',
  shiftCloses: 'tadfane_shift_closes',
  auditLog: 'audit_log',
};

function readLegacy() {
  const out = {};
  for (const [k, key] of Object.entries(LEGACY_KEYS)) {
    try {
      const raw = localStorage.getItem(key);
      if (raw) out[k] = JSON.parse(raw);
    } catch { /* ignore */ }
  }
  return out;
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

  // ---------- ເລີ່ມຕົ້ນ: ກວດ server + session ----------
  const init = useCallback(async () => {
    setServerError('');
    try {
      const h = await api('/api/health', { auth: false });
      setServerLanIps(h.lanIps);
      setNeedsSetup(!!h.needsSetup);
      if (getToken() && !h.needsSetup) {
        try {
          const me = await api('/api/auth/me');
          setCurrentUser(me.user);
        } catch (e) {
          if (e.status === 401) setToken(null);
          else throw e;
        }
      }
    } catch (e) {
      setServerError(e.message);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => { init(); }, [init]);

  // session ໝົດອາຍຸ / ຖືກປິດບັນຊີ → ອອກຈາກລະບົບ
  useEffect(() => {
    const onUnauthorized = () => {
      setToken(null);
      setCurrentUser(null);
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  // ໂຫຼດລາຍຊື່ຜູ້ໃຊ້ (ເຈົ້າຂອງເທົ່ານັ້ນ)
  const refreshUsers = useCallback(async () => {
    try {
      const r = await api('/api/users');
      setUsers(r.users || []);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'owner') refreshUsers();
    else setUsers([]);
  }, [currentUser?.id, currentUser?.role, refreshUsers]);

  // ---------- LOGIN / LOGOUT ----------
  const login = async (username, password) => {
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
    try { await api('/api/auth/logout', { method: 'POST' }); } catch { /* ignore */ }
    clearOutbox();
    setToken(null);
    setCurrentUser(null);
  }, []);

  // ---------- FIRST-RUN SETUP ----------
  /** ສ້າງບັນຊີເຈົ້າຂອງໃໝ່ (ເລືອກນຳເຂົ້າຂໍ້ມູນເກົ່າໃນ browser ນີ້ນຳໄດ້) */
  const setupOwner = async ({ username, name, password, phone, importLegacy = false }) => {
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

  /** ນຳເຂົ້າຂໍ້ມູນ + ບັນຊີເກົ່າທັງໝົດ (ເຂົ້າລະບົບດ້ວຍລະຫັດເດີມໄດ້ເລີຍ) */
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
    const r = await api('/api/users', { method: 'POST', body: userData });
    await refreshUsers();
    return r.user;
  };

  const updateUser = async (id, data) => {
    // eslint-disable-next-line no-unused-vars
    const { passwordHash, passwordSalt, ...rest } = data;
    if (!rest.password) delete rest.password;
    const r = await api(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: rest });
    await refreshUsers();
    if (id === currentUser?.id) setCurrentUser(r.user);
    return r.user;
  };

  const deleteUser = async (id) => {
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
    currentUser, users,
    login, logout, setupOwner, importLegacyWithAccounts, changePassword,
    addUser, updateUser, deleteUser, usernameExists, refreshUsers,
    hasRole, canAccess,
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [ready, needsSetup, serverError, currentUser, users, init, logout, refreshUsers]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
