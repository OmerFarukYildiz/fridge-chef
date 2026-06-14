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
import { FavoriteRecipe, PantryItem, Recipe, ShoppingItem } from '../types';

// ── Koleksiyon Referansları ───────────────────────────────────
const favoritesRef    = (uid: string) => collection(db, 'users', uid, 'favorites');
const shoppingListRef = (uid: string) => collection(db, 'users', uid, 'shoppingList');
const pantryRef       = (uid: string) => collection(db, 'users', uid, 'pantry');

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
// KULLANICI PROFİLİ
// ============================================================

export const updateUserPhoto = async (uid: string, base64: string | null): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { photoBase64: base64 });
};

export const updateUserAllergies = async (uid: string, allergies: string[]): Promise<void> => {
  await updateDoc(doc(db, 'users', uid), { 'preferences.allergies': allergies });
};
