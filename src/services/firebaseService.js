// =========================================================================
// Firebase Firestore & Storage Service for Tad Fane Resort
// - Firestore Native NoSQL (Collections & Documents)
// - Offline Persistence (IndexedDB)
// - Real-time Listeners (onSnapshot)
// - Firebase Storage for Signatures, Payment Slips & Images
// - ZKTeco Hardware Integration Ready (zk_attendance)
// =========================================================================

import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import {
  ref,
  uploadString,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../config/firebase';
import { initialRooms, initialHotelInfo, initialActivities } from '../data/initialData';

// Collections used in the Resort Management System
export const COLLECTIONS = {
  ROOMS: 'hotel_rooms',
  BOOKINGS: 'hotel_bookings',
  ACTIVITIES: 'hotel_activities',
  ACTIVITY_SALES: 'hotel_activity_sales',
  SHIFT_CLOSES: 'hotel_shift_closes',
  EXPENSES: 'hotel_expenses',
  MAINTENANCE: 'hotel_maintenance',
  RATE_PLANS: 'hotel_rate_plans',
  USERS: 'hotel_users',
  HOTEL_INFO: 'hotel_info',
  ZK_ATTENDANCE: 'zk_attendance', // for ZKTeco hardware integration
};

// ================== REAL-TIME LISTENERS ==================

/**
 * Subscribe to a Firestore collection with IndexedDB offline support
 */
export function subscribeCollection(collectionName, callback) {
  const colRef = collection(db, collectionName);
  return onSnapshot(
    colRef,
    (snapshot) => {
      const items = snapshot.docs.map((docSnap) => ({
        id: docSnap.id,
        ...docSnap.data(),
      }));
      callback(items);
    },
    (error) => {
      console.warn(`[Firestore] offline/cache fallback for ${collectionName}:`, error.message);
    }
  );
}

/**
 * Subscribe to a single document (e.g., hotelInfo)
 */
export function subscribeDoc(collectionName, docId, callback) {
  const docRef = doc(db, collectionName, docId);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        callback(docSnap.data());
      } else {
        callback(null);
      }
    },
    (error) => {
      console.warn(`[Firestore] error fetching doc ${collectionName}/${docId}:`, error.message);
    }
  );
}

// ================== DOCUMENT OPERATIONS ==================

export async function saveDocument(collectionName, id, data) {
  const docRef = doc(db, collectionName, String(id));
  await setDoc(docRef, { ...data, updatedAt: serverTimestamp() }, { merge: true });
}

export async function deleteDocument(collectionName, id) {
  const docRef = doc(db, collectionName, String(id));
  await deleteDoc(docRef);
}

// ================== INITIAL SETUP / SEEDING ==================

/**
 * Seed 24 rooms, activities, and hotelInfo if Firestore is fresh
 */
export async function seedInitialFirestoreData() {
  try {
    const roomsSnap = await getDocs(collection(db, COLLECTIONS.ROOMS));
    if (roomsSnap.empty) {
      console.log('Seeding initial 24 rooms into Firestore...');
      const batch = writeBatch(db);

      // Seed 24 rooms
      for (const room of initialRooms) {
        const rRef = doc(db, COLLECTIONS.ROOMS, String(room.id));
        batch.set(rRef, room);
      }

      // Seed activities
      for (const act of initialActivities) {
        const aRef = doc(db, COLLECTIONS.ACTIVITIES, String(act.id));
        batch.set(aRef, act);
      }

      // Seed hotel info
      const hRef = doc(db, COLLECTIONS.HOTEL_INFO, 'general');
      batch.set(hRef, initialHotelInfo);

      await batch.commit();
      console.log('Firestore initialized successfully with 24 rooms & activities!');
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error seeding Firestore data:', error);
    return false;
  }
}

// ================== FIREBASE STORAGE (SIGNATURES, SLIPS, IMAGES) ==================

/**
 * Upload Check-in guest digital signature to Firebase Storage
 * Returns public download URL
 */
export async function uploadGuestSignature(bookingId, signatureDataUrl) {
  if (!signatureDataUrl || !signatureDataUrl.startsWith('data:')) {
    return signatureDataUrl;
  }
  try {
    const storageRef = ref(storage, `signatures/${bookingId}-${Date.now()}.png`);
    await uploadString(storageRef, signatureDataUrl, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.warn('Storage upload error (using local data URL fallback):', err);
    return signatureDataUrl;
  }
}

/**
 * Upload payment slip to Firebase Storage
 */
export async function uploadPaymentSlip(bookingId, file) {
  try {
    const storageRef = ref(storage, `slips/${bookingId}-${Date.now()}-${file.name}`);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.error('Failed to upload slip to Firebase Storage:', err);
    throw err;
  }
}
