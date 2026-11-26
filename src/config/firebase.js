import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAuth } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyD9XskFK6za1q2r4mAe8Z1B7cY57oPywmM",
  authDomain: "tadfane-hotel-laos.firebaseapp.com",
  projectId: "tadfane-hotel-laos",
  storageBucket: "tadfane-hotel-laos.firebasestorage.app",
  messagingSenderId: "712405879012",
  appId: "1:712405879012:web:fd908d0fe0534a42c204f1",
};

export const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);
