import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import { createPasswordRecord, verifyPassword } from '../utils/security';
import { logAudit } from '../utils/audit';

const AuthContext = createContext(null);

const SESSION_KEY = 'hotel_session';
const USERS_KEY = 'hotel_users';
const ATTEMPTS_KEY = 'hotel_login_attempts';
const SESSION_HOURS = 12;
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 5;

// ລຶບຂໍ້ມູນລັບອອກກ່ອນສົ່ງໃຫ້ UI
const publicUser = (u) => {
  if (!u) return null;
  // eslint-disable-next-line no-unused-vars
  const { password, passwordHash, passwordSalt, ...rest } = u;
  return rest;
};

const readAttempts = () => {
  try { return JSON.parse(localStorage.getItem(ATTEMPTS_KEY) || '{}'); } catch { return {}; }
};
const writeAttempts = (a) => localStorage.setItem(ATTEMPTS_KEY, JSON.stringify(a));

export function AuthProvider({ children }) {
  const [users, setUsers] = useState(() => {
    try {
      const saved = localStorage.getItem(USERS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(() => {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null');
      // ຮູບແບບເກົ່າ (ເກັບ user ທັງໝົດ) ຫຼື ໝົດອາຍຸ → ບັງຄັບເຂົ້າລະບົບໃໝ່
      if (!s || !s.userId || !s.expiresAt || new Date(s.expiresAt) < new Date()) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }
      return s;
    } catch {
      return null;
    }
  });

  // ---------- Migration: ແປງລະຫັດຜ່ານແບບຂໍ້ຄວາມທຳມະດາ (ເກົ່າ) ໃຫ້ເປັນ hash ----------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const needs = users.some(u => typeof u.password === 'string');
      if (!needs) { setReady(true); return; }
      const migrated = await Promise.all(users.map(async (u) => {
        if (typeof u.password !== 'string') return u;
        const rec = await createPasswordRecord(u.password);
        // eslint-disable-next-line no-unused-vars
        const { password, ...rest } = u;
        return { ...rest, ...rec, mustChangePassword: false };
      }));
      if (!cancelled) {
        setUsers(migrated);
        setReady(true);
      }
    })();
    return () => { cancelled = true; };
    // run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!ready) return;
    localStorage.setItem(USERS_KEY, JSON.stringify(users));
  }, [users, ready]);

  // sync ລະຫວ່າງແຖບ (tab) ຂອງບຣາວເຊີ
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === USERS_KEY && e.newValue) {
        try { setUsers(JSON.parse(e.newValue)); } catch { /* ignore */ }
      }
      if (e.key === SESSION_KEY) {
        try { setSession(e.newValue ? JSON.parse(e.newValue) : null); } catch { setSession(null); }
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const rawCurrentUser = session ? users.find(u => u.id === session.userId) : null;
  const currentUser = useMemo(() => publicUser(rawCurrentUser), [rawCurrentUser]);

  // ກວດ session ໝົດອາຍຸທຸກນາທີ
  useEffect(() => {
    if (!session) return;
    const timer = setInterval(() => {
      if (new Date(session.expiresAt) < new Date()) {
        setSession(null);
        localStorage.removeItem(SESSION_KEY);
      }
    }, 60000);
    return () => clearInterval(timer);
  }, [session]);

  const needsSetup = ready && users.filter(u => u.role === 'owner').length === 0;

  const startSession = (user) => {
    const s = {
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_HOURS * 3600 * 1000).toISOString(),
    };
    setSession(s);
    localStorage.setItem(SESSION_KEY, JSON.stringify(s));
  };

  // ---------- LOGIN ----------
  const login = async (username, password) => {
    const uname = (username || '').trim().toLowerCase();
    const attempts = readAttempts();
    const rec = attempts[uname] || { count: 0, lockedUntil: null };

    if (rec.lockedUntil && new Date(rec.lockedUntil) > new Date()) {
      const mins = Math.ceil((new Date(rec.lockedUntil) - new Date()) / 60000);
      return { success: false, message: `ບັນຊີນີ້ຖືກລັອກຊົ່ວຄາວ ເນື່ອງຈາກໃສ່ລະຫັດຜິດຫຼາຍເທື່ອ. ກະລຸນາລອງໃໝ່ໃນ ${mins} ນາທີ` };
    }

    const user = users.find(u => u.username.toLowerCase() === uname);
    const ok = user && user.active !== false && await verifyPassword(password, user);

    if (!ok) {
      rec.count += 1;
      if (rec.count >= MAX_ATTEMPTS) {
        rec.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
        rec.count = 0;
        logAudit(user ? publicUser(user) : undefined, 'auth.locked', `ລັອກບັນຊີ "${uname}" ${LOCK_MINUTES} ນາທີ`);
      } else {
        logAudit(user ? publicUser(user) : undefined, 'auth.login_failed', `ຊື່ຜູ້ໃຊ້ "${uname}" (ເທື່ອທີ ${rec.count})`);
      }
      attempts[uname] = rec;
      writeAttempts(attempts);
      if (user && user.active === false) return { success: false, message: 'ບັນຊີນີ້ຖືກປິດການໃຊ້ງານ' };
      return { success: false, message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' };
    }

    delete attempts[uname];
    writeAttempts(attempts);
    startSession(user);
    logAudit(publicUser(user), 'auth.login', 'ເຂົ້າລະບົບສຳເລັດ');
    return { success: true, user: publicUser(user) };
  };

  const logout = useCallback(() => {
    if (currentUser) logAudit(currentUser, 'auth.logout', 'ອອກຈາກລະບົບ');
    setSession(null);
    localStorage.removeItem(SESSION_KEY);
  }, [currentUser]);

  // ---------- FIRST-RUN SETUP ----------
  const setupOwner = async ({ username, name, password, phone }) => {
    const rec = await createPasswordRecord(password);
    const owner = {
      id: `u${Date.now()}`, username: username.trim(), name: name.trim(), phone: phone || '',
      role: 'owner', active: true, mustChangePassword: false, ...rec,
    };
    setUsers(prev => [...prev, owner]);
    startSession(owner);
    logAudit(publicUser(owner), 'user.create', `ສ້າງບັນຊີເຈົ້າຂອງ "${owner.username}" (ຕັ້ງຄ່າຄັ້ງທຳອິດ)`);
  };

  // ---------- USER MANAGEMENT ----------
  const usernameExists = (username, exceptId) =>
    users.some(u => u.username.toLowerCase() === username.trim().toLowerCase() && u.id !== exceptId);

  const addUser = async (userData) => {
    const { password, ...rest } = userData;
    const rec = await createPasswordRecord(password);
    const newUser = {
      ...rest, username: rest.username.trim(), id: `u${Date.now()}`,
      active: true, mustChangePassword: false, ...rec,
    };
    setUsers(prev => [...prev, newUser]);
    logAudit(currentUser, 'user.create', `ເພີ່ມຜູ້ໃຊ້ "${newUser.username}" (${newUser.role})`);
  };

  const updateUser = async (id, data) => {
    // eslint-disable-next-line no-unused-vars
    const { password, passwordHash, passwordSalt, ...rest } = data;
    let rec = {};
    if (password) {
      rec = { ...(await createPasswordRecord(password)), mustChangePassword: false };
    }
    setUsers(prev => prev.map(u => u.id === id ? { ...u, ...rest, ...rec } : u));
    const target = users.find(u => u.id === id);
    logAudit(currentUser, 'user.update', `ແກ້ໄຂຜູ້ໃຊ້ "${target?.username}"${password ? ' (ຣີເຊັດລະຫັດຜ່ານ)' : ''}`);
  };

  const deleteUser = (id) => {
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));
    logAudit(currentUser, 'user.delete', `ລຶບຜູ້ໃຊ້ "${target?.username}"`);
  };

  const changePassword = async (currentPassword, newPassword) => {
    if (!rawCurrentUser) return { success: false, message: 'ກະລຸນາເຂົ້າລະບົບ' };
    const ok = await verifyPassword(currentPassword, rawCurrentUser);
    if (!ok) return { success: false, message: 'ລະຫັດຜ່ານປັດຈຸບັນບໍ່ຖືກຕ້ອງ' };
    if (await verifyPassword(newPassword, rawCurrentUser)) {
      return { success: false, message: 'ລະຫັດຜ່ານໃໝ່ຕ້ອງບໍ່ຊ້ຳກັບລະຫັດເກົ່າ' };
    }
    const rec = await createPasswordRecord(newPassword);
    setUsers(prev => prev.map(u => u.id === rawCurrentUser.id ? { ...u, ...rec, mustChangePassword: false } : u));
    logAudit(currentUser, 'auth.password_change', 'ປ່ຽນລະຫັດຜ່ານຂອງຕົນເອງ');
    return { success: true };
  };

  // ---------- RESET PASSWORD (ເມື່ອລືມລະຫັດ) ----------
  const resetPassword = async (username, newPassword, autoLogin = true) => {
    const uname = (username || '').trim().toLowerCase();
    const user = users.find(u => u.username.toLowerCase() === uname);
    if (!user) return { success: false, message: `ບໍ່ພົບຊື່ຜູ້ໃຊ້ "${username}" ໃນລະບົບ` };
    const rec = await createPasswordRecord(newPassword);
    const updatedUser = { ...user, ...rec, mustChangePassword: false };
    setUsers(prev => prev.map(u => u.id === user.id ? updatedUser : u));
    
    // Clear all failed login attempts & locks
    const attempts = readAttempts();
    delete attempts[uname];
    writeAttempts(attempts);

    if (autoLogin) {
      startSession(updatedUser);
    }

    logAudit(publicUser(user), 'auth.password_reset', `ຣີເຊັດລະຫັດຜ່ານສຳລັບ "${uname}" (ປົດລັອກອັດຕະໂນມັດ)`);
    return { success: true };
  };

  const unlockAccount = (username) => {
    const uname = (username || '').trim().toLowerCase();
    const attempts = readAttempts();
    if (uname) {
      delete attempts[uname];
    } else {
      localStorage.removeItem(ATTEMPTS_KEY);
    }
    writeAttempts(attempts);
  };

  // ---------- EMERGENCY LOGIN (ເຂົ້າລະບົບທັນທີ 100%) ----------
  const emergencyLogin = async () => {
    try {
      localStorage.removeItem(ATTEMPTS_KEY);
      let owner = users.find(u => u.role === 'owner') || users[0];
      const rec = await createPasswordRecord('Tadfane@2026');

      if (!owner) {
        owner = {
          id: `u${Date.now()}`,
          username: 'admin',
          name: 'ເຈົ້າຂອງຣີສອດ (Admin)',
          phone: '',
          role: 'owner',
          active: true,
          mustChangePassword: false,
          ...rec,
        };
        setUsers([owner]);
        localStorage.setItem(USERS_KEY, JSON.stringify([owner]));
      } else {
        owner = { ...owner, active: true, ...rec, mustChangePassword: false };
        setUsers(prev => {
          const updated = prev.map(u => u.id === owner.id ? owner : u);
          localStorage.setItem(USERS_KEY, JSON.stringify(updated));
          return updated;
        });
      }

      startSession(owner);
      logAudit(publicUser(owner), 'auth.emergency_login', 'ເຂົ້າລະບົບສຸກເສີນ (1-Click Login)');
      return { success: true, user: publicUser(owner) };
    } catch (err) {
      console.error('Emergency login error:', err);
      return { success: false, message: err.message };
    }
  };

  const hasRole = (roles) => {
    if (!currentUser) return false;
    if (typeof roles === 'string') return currentUser.role === roles;
    return roles.includes(currentUser.role);
  };

  const canAccess = (feature) => {
    if (!currentUser) return false;
    const permissions = {
      owner: ['dashboard', 'cashier', 'booking', 'activities', 'checkin', 'checkout', 'reports', 'settings', 'users', 'audit'],
      reception: ['dashboard', 'cashier', 'booking', 'activities', 'checkin', 'checkout'],
      housekeeping: ['dashboard'],
    };
    return permissions[currentUser.role]?.includes(feature) ?? false;
  };

  const publicUsers = useMemo(() => users.map(publicUser), [users]);

  return (
    <AuthContext.Provider value={{
      ready, needsSetup,
      currentUser, users: publicUsers,
      login, logout, setupOwner, changePassword, resetPassword, unlockAccount, emergencyLogin,
      addUser, updateUser, deleteUser, usernameExists,
      hasRole, canAccess,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};
