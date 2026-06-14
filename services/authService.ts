// ============================================================
// Fridge Chef — Auth Servisi
// ============================================================
// Firebase Authentication + Firestore profil yönetimi.
// Tüm auth işlemleri burada merkezi olarak yönetilir.
// ============================================================

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  AuthError,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebaseConfig';
import { UserPreferences } from '../types';

// ── Firebase Hata Mesajlarını Türkçeleştir ────────────────────
const getFirebaseErrorMessage = (error: AuthError): string => {
  switch (error.code) {
    case 'auth/email-already-in-use':
      return 'Bu e-posta adresi zaten kullanımda.';
    case 'auth/invalid-email':
      return 'Geçersiz e-posta adresi.';
    case 'auth/weak-password':
      return 'Şifre en az 6 karakter olmalıdır.';
    case 'auth/user-not-found':
      return 'Bu e-posta adresine ait hesap bulunamadı.';
    case 'auth/wrong-password':
      return 'Hatalı şifre. Lütfen tekrar deneyin.';
    case 'auth/invalid-credential':
      return 'E-posta veya şifre hatalı. Lütfen tekrar deneyin.';
    case 'auth/too-many-requests':
      return 'Çok fazla hatalı deneme. Lütfen bir süre bekleyin.';
    case 'auth/network-request-failed':
      return 'İnternet bağlantısı yok. Lütfen bağlantınızı kontrol edin.';
    default:
      return 'Bir hata oluştu. Lütfen tekrar deneyin.';
  }
};

// ── Kayıt Ol ─────────────────────────────────────────────────
/**
 * Yeni kullanıcı oluşturur ve Firestore'a profil kaydeder.
 * @param email - Kullanıcı e-postası
 * @param password - Şifre (min 6 karakter)
 * @param displayName - Görünen ad
 * @param preferences - Diyet ve alerji tercihleri
 */
export const registerUser = async (
  email: string,
  password: string,
  displayName: string,
  preferences: UserPreferences
): Promise<void> => {
  try {
    // Firebase Auth'ta kullanıcı oluştur
    const { user } = await createUserWithEmailAndPassword(auth, email, password);

    // Auth profiline görünen ad ekle
    await updateProfile(user, { displayName });

    // Firestore'a kullanıcı profil belgesi yaz
    await setDoc(doc(db, 'users', user.uid), {
      uid: user.uid,
      email: user.email,
      displayName,
      preferences,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    const authError = error as AuthError;
    throw new Error(getFirebaseErrorMessage(authError));
  }
};

// ── Giriş Yap ────────────────────────────────────────────────
/**
 * E-posta ve şifre ile giriş yapar.
 */
export const loginUser = async (
  email: string,
  password: string
): Promise<void> => {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    const authError = error as AuthError;
    throw new Error(getFirebaseErrorMessage(authError));
  }
};

// ── Çıkış Yap ────────────────────────────────────────────────
/**
 * Oturumu kapatır.
 */
export const logoutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    throw new Error('Çıkış yapılırken bir hata oluştu.');
  }
};
