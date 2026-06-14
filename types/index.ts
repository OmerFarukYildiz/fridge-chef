// ============================================================
// Fridge Chef — Merkezi TypeScript Tip Tanımları
// ============================================================

/**
 * Kullanıcının diyet ve alerji tercihleri.
 */
export interface UserPreferences {
  dietaryRestrictions: string[];
  allergies: string[];
}

/**
 * Firebase Auth + Firestore kullanıcı profili.
 */
export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoBase64?: string;
  preferences: UserPreferences;
  createdAt: Date;
}

/**
 * Gemini API'den dönen tarif nesnesi.
 */
export interface Recipe {
  tarifAdi: string;
  hazirlikSuresi: string;
  kaloriTahmini: string;
  kullanilanMalzemeler: string[];
  eksikMalzemeler: string[];
  adimAdimYapilisi: string[];
  ipuclari?: string;
}

/**
 * Firestore'da favorites alt koleksiyonunda saklanan tarif.
 */
export interface FavoriteRecipe extends Recipe {
  id: string;
  savedAt: number;
  imageBase64?: string;
}

/**
 * Firestore'da history alt koleksiyonunda saklanan tarif geçmişi.
 */
export interface HistoryRecipe extends Recipe {
  id: string;
  viewedAt: number;
}

/**
 * Firestore'da shoppingList alt koleksiyonunda saklanan öğe.
 */
export interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
  createdAt: number;
}

// ============================================================
// SANAL KİLER (PANTRY) TİPLERİ
// ============================================================

/**
 * Firestore'da pantry alt koleksiyonunda saklanan malzeme.
 */
export interface PantryItem {
  id: string;
  name: string;
  /** Unix millisecond timestamp. null = tarih girilmemiş */
  expiryDate: number | null;
  addedAt: number;
}

/**
 * STT durumu — badge rengi ve metni bu enum'a göre belirlenir.
 */
export type ExpiryStatus =
  | 'expired'        // Süresi dolmuş (kırmızı)
  | 'today'          // Bugün bitiyor (koyu kırmızı)
  | 'expiring_soon'  // 1–3 gün kaldı (turuncu/sarı)
  | 'fresh'          // 4+ gün kaldı (yeşil)
  | 'no_date';       // Tarih girilmemiş (gri)

/**
 * PantryItem için STT durumunu hesaplar.
 */
export const getExpiryStatus = (expiryDate: number | null): ExpiryStatus => {
  if (expiryDate === null) return 'no_date';
  const now = Date.now();
  const diffMs = expiryDate - now;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'expired';
  if (diffDays === 0) return 'today';
  if (diffDays <= 3) return 'expiring_soon';
  return 'fresh';
};

/**
 * STT'ye kalan gün sayısını hesaplar (negatif = geçmiş).
 */
export const getDaysUntilExpiry = (expiryDate: number | null): number | null => {
  if (expiryDate === null) return null;
  const diffMs = expiryDate - Date.now();
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

/**
 * STT durumuna göre Türkçe etiket ve renk döner.
 */
export const getExpiryLabel = (
  expiryDate: number | null
): { label: string; color: string; bgColor: string } => {
  const status = getExpiryStatus(expiryDate);
  const days = getDaysUntilExpiry(expiryDate);
  switch (status) {
    case 'expired':
      return { label: '⛔ Süresi Dolmuş', color: '#DC2626', bgColor: '#FEE2E2' };
    case 'today':
      return { label: '🔴 Bugün Bitiyor!', color: '#DC2626', bgColor: '#FEE2E2' };
    case 'expiring_soon':
      return {
        label: `⚠️ ${days} gün kaldı`,
        color: '#D97706',
        bgColor: '#FEF3C7',
      };
    case 'fresh':
      return {
        label: `✅ ${days} gün`,
        color: '#FFFFFF',
        bgColor: '#059669',
      };
    case 'no_date':
    default:
      return { label: 'STT Girilmedi', color: '#9CA3AF', bgColor: '#F3F4F6' };
  }
};

/**
 * Gemini'den non-food guardrail tetiklendiğinde fırlatılan özel hata.
 */
export class NonFoodImageError extends Error {
  constructor() {
    super('ERROR_NON_FOOD');
    this.name = 'NonFoodImageError';
  }
}
