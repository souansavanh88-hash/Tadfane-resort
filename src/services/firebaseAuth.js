import {
  collection,
  doc,
  getDocs,
  setDoc,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { createPasswordRecord, verifyPassword, validatePasswordStrength } from '../utils/security';

const USERS_COLL = 'hotel_users';
const SESSION_KEY = 'hotel_firebase_user';

export const getFirebaseSession = () => {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

export const setFirebaseSession = (user) => {
  try {
    if (user) {
      // eslint-disable-next-line no-unused-vars
      const { password, passwordHash, passwordSalt, ...safeUser } = user;
      localStorage.setItem(SESSION_KEY, JSON.stringify(safeUser));
    } else {
      localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    /* ignore */
  }
};

export async function checkFirebaseSetup() {
  try {
    const snap = await getDocs(collection(db, USERS_COLL));
    if (snap.empty) {
      return { needsSetup: true, hasOwner: false, users: [] };
    }
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const hasOwner = users.some(u => u.role === 'owner' && u.active !== false);
    return { needsSetup: !hasOwner, hasOwner, users };
  } catch (err) {
    console.warn('checkFirebaseSetup error:', err.message);
    const local = getFirebaseSession();
    return { needsSetup: !local, hasOwner: !!local, users: local ? [local] : [] };
  }
}

export async function firebaseLogin(username, password) {
  const cleanUsername = String(username || '').trim().toLowerCase();
  if (!cleanUsername || !password) {
    return { success: false, message: 'ກະລຸນາໃສ່ຊື່ຜູ້ໃຊ້ ແລະ ລະຫັດຜ່ານ' };
  }

  try {
    const snap = await getDocs(collection(db, USERS_COLL));
    const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const user = users.find(u => (u.username || '').toLowerCase() === cleanUsername);

    if (!user) {
      return { success: false, message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' };
    }

    if (user.active === false) {
      return { success: false, message: 'ບັນຊີນີ້ຖືກປິດໃຊ້ງານແລ້ວ' };
    }

    const isValid = await verifyPassword(password, user);
    if (!isValid) {
      return { success: false, message: 'ຊື່ຜູ້ໃຊ້ ຫຼື ລະຫັດຜ່ານບໍ່ຖືກຕ້ອງ' };
    }

    setFirebaseSession(user);
    // eslint-disable-next-line no-unused-vars
    const { password: pw, passwordHash, passwordSalt, ...safeUser } = user;
    return { success: true, user: safeUser };
  } catch (err) {
    console.error('firebaseLogin error:', err);
    return { success: false, message: 'ເກີດຂໍ້ຜິດພາດໃນການເຂົ້າສູ່ລະບົບ: ' + err.message };
  }
}

export async function firebaseSetupOwner({ username, name, password, phone }) {
  const cleanUsername = String(username || '').trim();
  const cleanName = String(name || '').trim();

  if (!cleanUsername || !cleanName) {
    return { success: false, message: 'ກະລຸນາໃສ່ຊື່ ແລະ ຊື່ຜູ້ໃຊ້' };
  }

  const pwErr = validatePasswordStrength(password, cleanUsername);
  if (pwErr) {
    return { success: false, message: pwErr };
  }

  try {
    const { passwordHash, passwordSalt } = await createPasswordRecord(password);
    const userId = `u-${Date.now()}`;
    const ownerData = {
      id: userId,
      username: cleanUsername,
      name: cleanName,
      phone: phone || '',
      role: 'owner',
      active: true,
      mustChangePassword: false,
      passwordHash,
      passwordSalt,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, USERS_COLL, userId), ownerData);
    setFirebaseSession(ownerData);

    // eslint-disable-next-line no-unused-vars
    const { passwordHash: h, passwordSalt: s, ...safeUser } = ownerData;
    return { success: true, user: safeUser };
  } catch (err) {
    console.error('firebaseSetupOwner error:', err);
    return { success: false, message: 'ບໍ່ສາມາດສ້າງບັນຊີເຈົ້າຂອງໄດ້: ' + err.message };
  }
}
