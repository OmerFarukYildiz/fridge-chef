// ============================================================
// Fridge Chef — Firebase Yapılandırması
// ============================================================
// Bu dosya Firebase uygulamasını SADECE BİR KEZ başlatır.
// Tüm servisleri (auth, db) buradan import edin.
//
// .env dosyasına aşağıdaki değişkenleri ekleyin:
//   EXPO_PUBLIC_FIREBASE_API_KEY=...
//   EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=...
//   EXPO_PUBLIC_FIREBASE_PROJECT_ID=...
//   EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=...
//   EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
//   EXPO_PUBLIC_FIREBASE_APP_ID=...
// ============================================================

import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeAuth, getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
// @ts-ignore — firebase/auth/react-native, firebase v10+ için doğru yol
import { getReactNativePersistence } from '@firebase/auth/dist/rn/index.js';

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

// Expo Fast Refresh sırasında uygulamanın tekrar başlatılmasını önle
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Auth — AsyncStorage ile kalıcı oturum (uygulama kapanınca oturum kaybolmaz)
let auth: ReturnType<typeof getAuth>;
try {
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} catch {
  // Zaten başlatılmış (Fast Refresh durumu)
  auth = getAuth(app);
}

export { auth };

// Firestore veritabanı
export const db = getFirestore(app);

export default app;
