// ============================================================
// Fridge Chef — Auth Context
// ============================================================
// Firebase Auth durumunu ve Firestore kullanıcı profilini
// tüm uygulamaya React Context ile sağlar.
//
// Kullanım:
//   const { user, userProfile, loading } = useAuth();
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebaseConfig';
import { UserProfile } from '../types';

// ── Context Tipi ─────────────────────────────────────────────
interface AuthContextType {
  /** Firebase Auth kullanıcısı (null = oturum açık değil) */
  user: User | null;
  /** Firestore'dan çekilen genişletilmiş profil (tercihler, alerjiler) */
  userProfile: UserProfile | null;
  /** Auth durumu ilk kez yükleniyorsa true (splash screen için) */
  loading: boolean;
  /** Profili yeniden yükle (kayıt/güncelleme sonrası çağrılır) */
  refreshProfile: () => Promise<void>;
}

// ── Context Oluştur ───────────────────────────────────────────
const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => {},
});

// ── Provider ─────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Firestore'dan kullanıcı profilini çek
  const fetchUserProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        setUserProfile(docSnap.data() as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('[AuthContext] Profil çekme hatası:', error);
      setUserProfile(null);
    }
  };

  // Profili dışarıdan yenilemek için (kayıt/güncelleme sonrası)
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  };

  // Firebase Auth durum değişikliklerini dinle
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);

      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }

      setLoading(false);
    });

    // Cleanup
    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth, AuthProvider içinde kullanılmalıdır.');
  }
  return context;
};
