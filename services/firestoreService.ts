// ============================================================
// Fridge Chef — Firestore Servisi
// ============================================================
// Veri yapısı:
//   users/{uid}/favorites/{recipeId}
//   users/{uid}/shoppingList/{itemId}
//   users/{uid}/pantry/{itemId}       ← YENİ
// ============================================================

import {
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from './firebaseConfig';
import { FavoriteRecipe, HistoryRecipe, PantryItem, Recipe, ShoppingItem, FamilyGroup, FeedPost } from '../types';

// ── Koleksiyon Referansları ───────────────────────────────────
// Favoriler ve Geçmiş kişiseldir. Alışveriş Listesi ve Kiler ortak (aile) kullanılabilir.
const favoritesRef    = (uid: string) => collection(db, 'users', uid, 'favorites');
const historyRef      = (uid: string) => collection(db, 'users', uid, 'history');
const shoppingListRef = (targetId: string) => collection(db, 'users', targetId, 'shoppingList');
const pantryRef       = (targetId: string) => collection(db, 'users', targetId, 'pantry');
const globalFeedRef   = () => collection(db, 'globalFeed');
const familiesRef     = () => collection(db, 'families');

// ============================================================
// FAVORİLER
// ============================================================

export const addToFavorites = async (uid: string, recipe: Recipe): Promise<string> => {
  const docRef = await addDoc(favoritesRef(uid), {
    ...recipe,
    savedAt: serverTimestamp(),
  });
  return docRef.id;
};

export const getFavorites = async (uid: string): Promise<FavoriteRecipe[]> => {
  const q = query(favoritesRef(uid), orderBy('savedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      savedAt: data.savedAt instanceof Timestamp ? data.savedAt.toMillis() : Date.now(),
    } as FavoriteRecipe;
  });
};

export const removeFromFavorites = async (uid: string, recipeId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'favorites', recipeId));
};

// ============================================================
// ALIŞVERİŞ LİSTESİ
// ============================================================

export const addItemsToShoppingList = async (uid: string, itemNames: string[]): Promise<void> => {
  const existing = await getShoppingList(uid);
  const existingNames = existing.map((i) => i.name.toLowerCase().trim());
  const newItems = itemNames.filter(
    (name) => !existingNames.includes(name.toLowerCase().trim())
  );
  await Promise.all(
    newItems.map((name) =>
      addDoc(shoppingListRef(uid), { name: name.trim(), checked: false, createdAt: serverTimestamp() })
    )
  );
};

export const getShoppingList = async (uid: string): Promise<ShoppingItem[]> => {
  const q = query(shoppingListRef(uid), orderBy('createdAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      checked: data.checked,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
    } as ShoppingItem;
  });
};

export const toggleShoppingItem = async (uid: string, itemId: string, checked: boolean): Promise<void> => {
  await updateDoc(doc(db, 'users', uid, 'shoppingList', itemId), { checked });
};

export const deleteShoppingItem = async (uid: string, itemId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'shoppingList', itemId));
};

export const clearCheckedItems = async (uid: string): Promise<void> => {
  const items = await getShoppingList(uid);
  const checked = items.filter((i) => i.checked);
  await Promise.all(checked.map((i) => deleteShoppingItem(uid, i.id)));
};

// ============================================================
// SANAL KİLER (PANTRY)
// ============================================================

/**
 * Malzemeleri kilere ekler.
 * Zaten kilerde olan malzemeleri tekrar eklemez (duplicate check — küçük harf karşılaştırma).
 * @returns Eklenen yeni öğe sayısı
 */
export const addItemsToPantry = async (
  uid: string,
  itemNames: string[]
): Promise<number> => {
  const existing = await getPantryItems(uid);
  const existingNames = existing.map((i) => i.name.toLowerCase().trim());

  const newItems = itemNames.filter(
    (name) => !existingNames.includes(name.toLowerCase().trim())
  );

  await Promise.all(
    newItems.map((name) =>
      addDoc(pantryRef(uid), {
        name: name.trim(),
        expiryDate: null,
        addedAt: serverTimestamp(),
      })
    )
  );

  return newItems.length;
};

/**
 * Tüm kiler öğelerini çeker (addedAt'e göre azalan sıra).
 */
export const getPantryItems = async (uid: string): Promise<PantryItem[]> => {
  const q = query(pantryRef(uid), orderBy('addedAt', 'desc'));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      id: docSnap.id,
      name: data.name,
      expiryDate: data.expiryDate ?? null,
      addedAt: data.addedAt instanceof Timestamp ? data.addedAt.toMillis() : Date.now(),
    } as PantryItem;
  });
};

/**
 * Bir kiler öğesinin STT tarihini günceller.
 * @param expiryDate - Unix millisecond timestamp. null = tarihi temizle
 */
export const updatePantryItemExpiry = async (
  uid: string,
  itemId: string,
  expiryDate: number | null
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid, 'pantry', itemId), { expiryDate });
};

/**
 * Bir kiler öğesini siler.
 */
export const deleteFromPantry = async (uid: string, itemId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'pantry', itemId));
};

/**
 * STT'si yaklaşan (N gün veya daha az kalan) kiler öğelerini döner.
 * Süresi dolanlar da dahildir.
 * @param daysThreshold - Gün eşiği (varsayılan: 3)
 */
export const getExpiringSoonItems = async (
  uid: string,
  daysThreshold: number = 3
): Promise<PantryItem[]> => {
  const allItems = await getPantryItems(uid);
  const thresholdMs = daysThreshold * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() + thresholdMs;

  return allItems.filter(
    (item) => item.expiryDate !== null && item.expiryDate <= cutoff
  );
};

// ============================================================
// TARİF GEÇMİŞİ (HISTORY)
// ============================================================

/**
 * Tarifi geçmişe ekler. Aynı tarif adı varsa viewedAt güncellenir.
 */
const HISTORY_LIMIT = 20;

export const addToHistory = async (uid: string, recipe: Recipe): Promise<string> => {
  // Aynı isimde tarif varsa tekrar ekleme, güncelle
  const existing = await getHistory(uid);
  const existingDoc = existing.find((h) => h.tarifAdi === recipe.tarifAdi);
  if (existingDoc) {
    await updateDoc(doc(db, 'users', uid, 'history', existingDoc.id), {
      ...recipe,
      viewedAt: serverTimestamp(),
    });
    return existingDoc.id;
  }

  // 20 tarif sınırını aşıyorsa en eski kaydı sil
  if (existing.length >= HISTORY_LIMIT) {
    const oldest = existing[existing.length - 1]; // En eski (son sıradaki)
    await deleteFromHistory(uid, oldest.id);
  }

  const docRef = await addDoc(historyRef(uid), {
    ...recipe,
    viewedAt: serverTimestamp(),
  });
  return docRef.id;
};

/**
 * Tüm tarif geçmişini çeker (en yeniden eskiye).
 */
export const getHistory = async (uid: string): Promise<HistoryRecipe[]> => {
  const q = query(historyRef(uid), orderBy('viewedAt', 'desc'));
  const snapshot = await getDocs(q);
  return snapshot.docs.map((docSnap) => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      viewedAt: data.viewedAt instanceof Timestamp ? data.viewedAt.toMillis() : Date.now(),
    } as HistoryRecipe;
  });
};

/**
 * Tek bir tarifi geçmişten siler.
 */
export const deleteFromHistory = async (uid: string, recipeId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'history', recipeId));
};

/**
 * Tüm tarif geçmişini temizler.
 */
export const clearHistory = async (uid: string): Promise<void> => {
  const items = await getHistory(uid);
  await Promise.all(items.map((i) => deleteFromHistory(uid, i.id)));
};

// ============================================================
// KULLANICI PROFİLİ
// ============================================================

export const updateUserPhoto = async (uid: string, base64: string | null): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { photoBase64: base64 });
};

export const updateUserAllergies = async (uid: string, allergies: string[]): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { 'preferences.allergies': allergies });
};

export const updateUserDietaryRestrictions = async (uid: string, restrictions: string[]): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { 'preferences.dietaryRestrictions': restrictions });
};

export const updateFavoriteRatingAndNote = async (
  uid: string,
  favoriteId: string,
  rating: number,
  note: string
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid, 'favorites', favoriteId), {
    rating,
    note,
    ratedAt: serverTimestamp(),
  });
};

// ============================================================
// Günlük Kalori Takibi
// ============================================================
const getTodayKey = () => new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

export const addCaloriesToday = async (uid: string, calories: number): Promise<void> => {
  const dateKey = getTodayKey();
  const ref = doc(db, 'users', uid, 'dailyCalories', dateKey);
  // Firestore'da yoksa oluştur, varsa üstüne ekle
  const snap = await import('firebase/firestore').then(m => m.getDoc(ref));
  if (snap.exists()) {
    const current = (snap.data().total as number) || 0;
    await updateDoc(ref, { total: current + calories, updatedAt: serverTimestamp() });
  } else {
    const { setDoc } = await import('firebase/firestore');
    await setDoc(ref, { total: calories, date: dateKey, updatedAt: serverTimestamp() });
  }
};

export const getDailyCalories = async (uid: string): Promise<number> => {
  const dateKey = getTodayKey();
  const ref = doc(db, 'users', uid, 'dailyCalories', dateKey);
  const snap = await import('firebase/firestore').then(m => m.getDoc(ref));
  if (snap.exists()) return (snap.data().total as number) || 0;
  return 0;
};

export const getWeeklyCalories = async (uid: string): Promise<{ dateKey: string, total: number }[]> => {
  const { collection, getDocs, query, limit, orderBy } = await import('firebase/firestore');
  const q = query(collection(db, 'users', uid, 'dailyCalories'), orderBy('date', 'desc'), limit(7));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ dateKey: doc.data().date, total: doc.data().total as number }));
};

export const setCalorieGoal = async (uid: string, goal: number): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { calorieGoal: goal });
};

// ============================================================
// FAZ 4 — Mutfak Envanteri, Fitness, Çocuk Modu
// ============================================================
import { KitchenEquipment, FitnessGoal, Badge, LeftoverItem } from '../types';

export const updateKitchenEquipment = async (
  uid: string,
  equipment: KitchenEquipment[]
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { kitchenEquipment: equipment });
};

export const updateFitnessGoal = async (
  uid: string,
  goal: FitnessGoal
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { fitnessGoal: goal ?? null });
};

export const updateChildMode = async (
  uid: string,
  enabled: boolean
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { childMode: enabled });
};

export const updateLanguage = async (
  uid: string,
  lang: 'tr' | 'en' | 'de'
): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { language: lang });
};

// ============================================================
// FAZ 4 — Leftover (Artan Yemekler)
// ============================================================
const leftoversRef = (uid: string) => collection(db, 'users', uid, 'leftovers');

export const addLeftover = async (
  uid: string,
  name: string,
  portion: string
): Promise<void> => {
  await addDoc(leftoversRef(uid), {
    name,
    portion,
    addedAt: serverTimestamp(),
  });
};

export const getLeftovers = async (uid: string): Promise<LeftoverItem[]> => {
  const q = query(leftoversRef(uid), orderBy('addedAt', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({
    id: d.id,
    name: d.data().name as string,
    portion: d.data().portion as string,
    addedAt: d.data().addedAt instanceof Timestamp ? d.data().addedAt.toMillis() : Date.now(),
  }));
};

export const deleteLeftover = async (uid: string, itemId: string): Promise<void> => {
  await deleteDoc(doc(db, 'users', uid, 'leftovers', itemId));
};

// ============================================================
// FAZ 4 — Rozet Sistemi
// ============================================================

/** 10 sabit rozet tanımı */
export const ALL_BADGES: Badge[] = [
  { id: 'first_recipe',    emoji: '👨‍🍳', name: 'Çırak Şef',         description: 'İlk tarifini oluşturdun!' },
  { id: 'five_hot',        emoji: '🔥', name: 'Ateşin Efendisi',     description: '5 sıcak yemek pişirdin.' },
  { id: 'zero_waste',      emoji: '♻️', name: 'Sıfır Atık Ustası',   description: 'Bozulmak üzere olan malzemelerle 3 tarif yaptın.' },
  { id: 'vegan_explorer',  emoji: '🌱', name: 'Vegan Kaşif',         description: 'Vegan modda 5 tarif oluşturdun.' },
  { id: 'protein_beast',   emoji: '💪', name: 'Protein Canavarı',    description: 'Kas kazanım hedefiyle 10 tarif yaptın.' },
  { id: 'world_cuisine',   emoji: '🌍', name: 'Dünya Kaşifi',        description: '5 farklı mutfak türünde yemek yaptın.' },
  { id: 'camera_eye',      emoji: '📸', name: 'Kamera Gözü',         description: 'Kamera ile 10 malzeme tespiti yaptın.' },
  { id: 'family_bond',     emoji: '👨‍👩‍👧', name: 'Aile Bağları',       description: 'Aile hesabıyla ilk tarifi birlikte yaptın.' },
  { id: 'quick_chef',      emoji: '⚡', name: 'Hızlı Şef',           description: '5 dakikada hazırlanan 5 atıştırmalık yaptın.' },
  { id: 'recipe_author',   emoji: '📝', name: 'Tarif Yazarı',        description: 'İlk manuel tarifini yazdın.' },
];

export const unlockBadge = async (uid: string, badgeId: string): Promise<boolean> => {
  const { getDoc, setDoc, arrayUnion } = await import('firebase/firestore');
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  const current: Badge[] = (snap.data()?.badges as Badge[]) || [];
  if (current.some((b) => b.id === badgeId)) return false; // zaten var
  const badge = ALL_BADGES.find((b) => b.id === badgeId);
  if (!badge) return false;
  const earned: Badge = { ...badge, earnedAt: Date.now() };
  await updateDoc(ref, { badges: arrayUnion(earned) });
  return true; // yeni kazanıldı
};

export const getBadges = async (uid: string): Promise<Badge[]> => {
  const { getDoc } = await import('firebase/firestore');
  const snap = await getDoc(doc(db, 'users', uid));
  return (snap.data()?.badges as Badge[]) || [];
};

// ============================================================
// FAZ 4 — Haftalık Yenilen Yemek İstatistikleri
// ============================================================

/** Son 7 günün kalori ve tarif sayısını döner */
export const getWeeklyStats = async (
  uid: string
): Promise<{ date: string; calories: number }[]> => {
  const { getDoc } = await import('firebase/firestore');
  const result: { date: string; calories: number }[] = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = d.toISOString().split('T')[0];
    const ref = doc(db, 'users', uid, 'dailyCalories', key);
    const snap = await getDoc(ref);
    result.push({ date: key, calories: snap.exists() ? ((snap.data().total as number) || 0) : 0 });
  }
  return result;
};

// ============================================================
// AİLE HESAPLARI (FAMILY ACCOUNTS)
// ============================================================

export const createOrGetFamilyInvite = async (uid: string): Promise<string> => {
  const { getDoc, setDoc } = await import('firebase/firestore');
  const familyDoc = doc(db, 'families', uid);
  const snap = await getDoc(familyDoc);
  if (snap.exists()) {
    return snap.data().inviteCode as string;
  }
  
  // Rastgele 6 haneli kod üret
  const inviteCode = Math.random().toString(36).substring(2, 8).toUpperCase();
  const newFamily: FamilyGroup = {
    id: uid,
    ownerId: uid,
    inviteCode,
    createdAt: Date.now(),
  };
  await setDoc(familyDoc, newFamily);
  return inviteCode;
};

export const joinFamilyWithCode = async (myUid: string, inviteCode: string): Promise<boolean> => {
  const { getDocs, query, where, updateDoc } = await import('firebase/firestore');
  const q = query(familiesRef(), where('inviteCode', '==', inviteCode.toUpperCase()));
  const snapshot = await getDocs(q);
  
  if (snapshot.empty) {
    throw new Error('Geçersiz davet kodu.');
  }
  
  const familyDoc = snapshot.docs[0];
  const familyId = familyDoc.id;
  
  if (familyId === myUid) {
    throw new Error('Kendi ailenize katılamazsınız.');
  }
  
  // Kullanıcının profiline familyId ekle
  await updateDoc(doc(db, 'users', myUid), { familyId });
  return true;
};

export const leaveFamily = async (myUid: string): Promise<void> => {
  const { updateDoc, deleteField } = await import('firebase/firestore');
  await updateDoc(doc(db, 'users', myUid), { familyId: deleteField() });
};

// ============================================================
// SOSYAL AKIŞ (CHEF'S FEED)
// ============================================================

export const shareToFeed = async (post: Omit<FeedPost, 'id' | 'createdAt' | 'likes' | 'likedBy'>): Promise<void> => {
  await addDoc(globalFeedRef(), {
    ...post,
    likes: 0,
    likedBy: [],
    createdAt: serverTimestamp(),
  });
};

export const getFeedPosts = async (): Promise<FeedPost[]> => {
  const { limit } = await import('firebase/firestore');
  const q = query(globalFeedRef(), orderBy('createdAt', 'desc'), limit(50));
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => {
    const data = docSnap.data();
    return {
      ...data,
      id: docSnap.id,
      createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toMillis() : Date.now(),
    } as FeedPost;
  });
};

export const toggleLikePost = async (postId: string, uid: string): Promise<void> => {
  const { getDoc, updateDoc, arrayUnion, arrayRemove, increment } = await import('firebase/firestore');
  const postDoc = doc(db, 'globalFeed', postId);
  const snap = await getDoc(postDoc);
  if (!snap.exists()) return;
  
  const data = snap.data();
  const likedBy: string[] = data.likedBy || [];
  
  if (likedBy.includes(uid)) {
    // Unlike
    await updateDoc(postDoc, {
      likes: increment(-1),
      likedBy: arrayRemove(uid)
    });
  } else {
    // Like
    await updateDoc(postDoc, {
      likes: increment(1),
      likedBy: arrayUnion(uid)
    });
  }
};

export const deleteFeedPost = async (postId: string): Promise<void> => {
  const { deleteDoc, doc } = await import('firebase/firestore');
  await deleteDoc(doc(db, 'globalFeed', postId));
};
