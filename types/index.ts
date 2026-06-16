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
 * Mutfak aleti tanımı (Airfryer, Blender vb.)
 */
export type KitchenEquipment =
  | 'Fırın'
  | 'Airfryer'
  | 'Blender'
  | 'Wok'
  | 'Döküm Tava'
  | 'Buharlı Pişirici'
  | 'Izgara'
  | 'Çok Amaçlı Tencere';

/**
 * Fitness hedefi
 */
export type FitnessGoal = 'Kilo Ver' | 'Kas Kazan' | 'Forma Kal' | null;

/**
 * Rozet (Achievement / Badge) tanımı
 */
export interface Badge {
  id: string;
  name: string;
  emoji: string;
  description: string;
  earnedAt?: number; // ms — kazanıldıysa
}

/**
 * Artan yemek (Leftover) kaydı
 */
export interface LeftoverItem {
  id: string;
  name: string;       // "Fırın Makarna"
  portion: string;    // "Yarım porsiyon", "2 porsiyon"
  addedAt: number;
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
  // Faz 4 eklentileri:
  kitchenEquipment?: KitchenEquipment[];   // Sahip olunan mutfak aletleri
  fitnessGoal?: FitnessGoal;               // Fitness hedefi
  childMode?: boolean;                     // Çocuk modu
  language?: 'tr' | 'en' | 'de';          // Uygulama dili
  familyId?: string;                       // Aile grubu ID'si
  badges?: Badge[];                        // Kazanılan rozetler
  consumedCaloriesToday?: number;          // Günlük tüketilen kalori
}

/**
 * Aile grubu yapısı (Davet kodu için de kullanılır)
 */
export interface FamilyGroup {
  id: string;              // Aile ID'si (genellikle kurucunun UID'si)
  ownerId: string;         // Kurucunun UID'si
  inviteCode: string;      // Geçici/kısa davet kodu
  createdAt: number;       // Timestamp
}

/**
 * Sosyal akış paylaşımı (Chef's Feed)
 */
export interface FeedPost {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  recipe: Recipe;
  likes: number;
  likedBy: string[];       // Beğenen kullanıcıların UID'leri
  createdAt: number;       // Timestamp
}

/**
 * Gemini API'den dönen besin değerleri.
 */
export interface NutritionInfo {
  protein: string;        // örn: '~28g'
  karbonhidrat: string;   // örn: '~45g'
  yag: string;            // örn: '~12g'
}

/**
 * 10 seçenek ekranında gösterilen kısa tarif özeti.
 */
export interface RecipeOption {
  tarifAdi: string;
  hazirlikSuresi: string;
  kaloriTahmini: string;
  zorlukSeviyesi: 'Kolay' | 'Orta' | 'Zor';
  mutfakTuru: string;       // 'Türk', 'İtalyan', 'Asya' vb.
  kisaAciklama: string;     // 1-2 cümle
  kategori: 'Kahvaltı' | 'Öğle' | 'Akşam' | 'Atıştırmalık' | 'Tatlı' | 'Çorba' | 'Salata' | 'Diğer';
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
  // Yeni alanlar:
  besinDegerleri?: NutritionInfo;
  kategori?: RecipeOption['kategori'];
  zorlukSeviyesi?: 'Kolay' | 'Orta' | 'Zor';
  mutfakTuru?: string;
  porsiyonSayisi?: number;
}

/**
 * Firestore'da favorites alt koleksiyonunda saklanan tarif.
 */
export interface FavoriteRecipe extends Recipe {
  id: string;
  savedAt: number;
  imageBase64?: string;
  // Puanlama & Not:
  rating?: number;          // 1–5
  note?: string;            // kullanıcı notu
  ratedAt?: number;         // puanlama zamanı (ms)
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
