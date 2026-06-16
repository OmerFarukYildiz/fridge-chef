// ============================================================
// Fridge Chef — Gemini AI Servisi (Production-Ready v2)
// ============================================================
// Özellikler:
//  1. Kısıtlayıcı System Instruction (Guardrail)
//  2. Non-food görsel → ERROR_NON_FOOD kodu → NonFoodImageError
//  3. Strict JSON çıktısı (parse güvenli)
//  4. Kullanıcı diyet/alerji tercihlerini prompt'a enjekte eder
//  5. eksikMalzemeler → Alışveriş listesi entegrasyonu
//  6. Rastgele mutfak/teknik enjeksiyonu → Çeşitlilik
//  7. 10 Tarif Seçeneği (hızlı liste) + Detaylı tarif (seçim sonrası)
//  8. Besin değerleri (protein/karbonhidrat/yağ)
//  9. Kategori + Zorluk seviyesi
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { NonFoodImageError, Recipe, RecipeOption, UserProfile } from '../types';

// ── API İstemcisi ────────────────────────────────────────────
const getAiClient = () => {
  const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'EXPO_PUBLIC_GEMINI_API_KEY tanımlı değil. Lütfen .env dosyasını kontrol edin.'
    );
  }
  return new GoogleGenAI({ apiKey });
};

// ── Çeşitlilik Havuzları ─────────────────────────────────────
const CUISINE_POOL = [
  'Türk', 'İtalyan', 'Meksika', 'Japon', 'Hint',
  'Fransız', 'Çin', 'Yunan', 'Kore', 'İspanyol',
  'Orta Doğu', 'Amerikan', 'Tayland', 'Fas',
];

const TECHNIQUE_POOL = [
  'fırında pişirme', 'tavada kavurma', 'buharda pişirme',
  'ızgara', 'haşlama', 'wok', 'sote', 'kızartma',
  'çiğ / salata', 'güveç', 'marine edip pişirme',
];

const MEAL_TIME_POOL = [
  'sabah kahvaltısı', 'hafif öğle yemeği', 'doyurucu akşam yemeği',
  'hızlı atıştırmalık', 'sağlıklı tatlı',
];

const pickRandom = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

const buildDiversityText = (): string => {
  const cuisine = pickRandom(CUISINE_POOL);
  const technique = pickRandom(TECHNIQUE_POOL);
  const meal = pickRandom(MEAL_TIME_POOL);
  return `\n\n## ÇEŞİTLİLİK KURALI (ÖNEMLİ):\nBu seferde özellikle ${cuisine} mutfağından ilham alan, ${technique} tekniğiyle hazırlanan, ${meal} için uygun bir tarif öner. Sıradan veya klişe tariflerden kaçın. Farklı ve yaratıcı ol.`;
};

// ── Kullanıcı Tercihlerini Prompt'a Enjekte Et ───────────────
const buildUserPreferencesText = (profile?: UserProfile): string => {
  if (!profile) return '';
  const parts: string[] = [];
  const prefs = profile.preferences;
  if (prefs?.dietaryRestrictions && prefs.dietaryRestrictions.length > 0) {
    parts.push(`Diyet Kısıtlamaları: ${prefs.dietaryRestrictions.join(', ')}`);
  }
  if (prefs?.allergies && prefs.allergies.length > 0) {
    parts.push(`Alerjiler (KESİNLİKLE KULLANMA): ${prefs.allergies.join(', ')}`);
  }
  if (profile.kitchenEquipment && profile.kitchenEquipment.length > 0) {
    parts.push(`Mutfak Aletleri (Sadece bunlara uygun veya ocak/fırın gibi temellere uygun tarif ver): ${profile.kitchenEquipment.join(', ')}`);
  }
  if (profile.fitnessGoal) {
    parts.push(`Fitness Hedefi: ${profile.fitnessGoal} (Buna uygun makroları ve porsiyonları ayarla)`);
  }
  if (profile.childMode) {
    parts.push(`Çocuk Modu AÇIK: Sebzeleri gizle, daha az baharatlı, eğlenceli şekilli ve çocuk dostu bir tarif ver.`);
  }
  if (profile.language && profile.language !== 'tr') {
    parts.push(`Uygulama Dili (Çıktıyı bu dilde ver): ${profile.language.toUpperCase()}`);
  }
  if (parts.length === 0) return '';
  return `\n\n## KULLANICI TERCİHLERİ (ZORUNLU — Bu kurallara kesinlikle uy):\n${parts.join('\n')}`;
};

const getLanguageName = (lang?: string) => {
  if (lang === 'en') return 'İngilizce';
  if (lang === 'de') return 'Almanca';
  return 'Türkçe';
};

// ── Gemini'den Gelen Metni Güvenli Parse Et ─────────────────
const safeParseJson = (text: string): unknown => {
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  return JSON.parse(cleaned);
};

// ── Dizi Alanı Güvenlik Fonksiyonu ──────────────────────────
const ensureArrayFields = (
  parsed: Record<string, unknown>,
  fields: string[]
): void => {
  for (const field of fields) {
    if (!Array.isArray(parsed[field])) {
      parsed[field] = [];
    }
  }
};

// ── Tarifi Standartlaştır / Düzelt (Normalize) ───────────────
export const normalizeRecipe = (raw: any): Recipe => {
  const parsed = { ...raw };

  const mapKey = (targetKey: string, alternateKeys: string[]) => {
    if (parsed[targetKey] !== undefined) return;
    for (const alt of alternateKeys) {
      if (parsed[alt] !== undefined) {
        parsed[targetKey] = parsed[alt];
        break;
      }
    }
  };

  mapKey('tarifAdi', ['tarifAdı', 'tarif_adi', 'tarif_adı', 'recipeName', 'name', 'tarifName']);
  mapKey('hazirlikSuresi', ['hazırlıkSüresi', 'hazırlık_süresi', 'hazirlik_suresi', 'prepTime', 'duration']);
  mapKey('kaloriTahmini', ['kalori_tahmini', 'kalori', 'calories', 'estimatedCalories']);
  mapKey('kullanilanMalzemeler', ['kullanılanMalzemeler', 'kullanılan_malzemeler', 'kullanilan_malzemeler', 'ingredients', 'usedIngredients']);
  mapKey('eksikMalzemeler', ['eksik_malzemeler', 'missingIngredients', 'neededIngredients']);
  mapKey('adimAdimYapilisi', ['adımAdımYapılışı', 'adım_adım_yapılışı', 'adim_adim_yapilisi', 'steps', 'instructions', 'yapilisi', 'yapılışı']);
  mapKey('ipuclari', ['şefNotu', 'sefNotu', 'sef_notu', 'ipuçları', 'tips', 'tip']);
  mapKey('besinDegerleri', ['besinDeğerleri', 'besin_degerleri', 'nutrition', 'nutrients']);
  mapKey('zorlukSeviyesi', ['zorluk', 'zorluk_seviyesi', 'difficulty']);
  mapKey('mutfakTuru', ['mutfakTürü', 'mutfak_turu', 'cuisine']);
  mapKey('porsiyonSayisi', ['porsiyonSayısi', 'porsiyonSayısı', 'porsiyon_sayisi', 'servings']);

  if (!Array.isArray(parsed.kullanilanMalzemeler)) parsed.kullanilanMalzemeler = [];
  if (!Array.isArray(parsed.eksikMalzemeler)) parsed.eksikMalzemeler = [];
  if (!Array.isArray(parsed.adimAdimYapilisi)) parsed.adimAdimYapilisi = [];

  if (typeof parsed.tarifAdi !== 'string') parsed.tarifAdi = 'İsimsiz Tarif';
  if (typeof parsed.hazirlikSuresi !== 'string') parsed.hazirlikSuresi = '30 dakika';
  if (typeof parsed.kaloriTahmini !== 'string') parsed.kaloriTahmini = '~300 kcal';
  if (typeof parsed.ipuclari !== 'string') parsed.ipuclari = '';
  if (typeof parsed.mutfakTuru !== 'string') parsed.mutfakTuru = 'Pratik';
  if (typeof parsed.zorlukSeviyesi !== 'string') parsed.zorlukSeviyesi = 'Orta';
  if (typeof parsed.porsiyonSayisi !== 'number') parsed.porsiyonSayisi = 2;

  if (!parsed.besinDegerleri || typeof parsed.besinDegerleri !== 'object') {
    parsed.besinDegerleri = { protein: '~15g', karbonhidrat: '~35g', yag: '~10g' };
  } else {
    const nut = parsed.besinDegerleri;
    const mapNutKey = (key: string, alts: string[]) => {
      if (nut[key] !== undefined) return;
      for (const alt of alts) {
        if (nut[alt] !== undefined) {
          nut[key] = nut[alt];
          break;
        }
      }
    };
    mapNutKey('protein', ['prot', 'proteins']);
    mapNutKey('karbonhidrat', ['karb', 'carbs', 'carbohydrate', 'carbohydrates']);
    mapNutKey('yag', ['yağ', 'fat', 'fats']);
    
    if (typeof nut.protein !== 'string') nut.protein = '~15g';
    if (typeof nut.karbonhidrat !== 'string') nut.karbonhidrat = '~35g';
    if (typeof nut.yag !== 'string') nut.yag = '~10g';
  }

  return parsed as Recipe;
};

// ============================================================
// FONKSİYON 1: 10 Tarif Seçeneği Getir (Hızlı Liste)
// ============================================================
/**
 * Görseli analiz edip 10 kısa tarif seçeneği döndürür.
 * Her seçenek sadece özet bilgi içerir (detaysız, hızlı).
 */
export const getRecipeOptionsFromImage = async (
  base64Image: string,
  userProfile?: UserProfile,
  excludeRecipes: string[] = []
): Promise<RecipeOption[]> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(userProfile);
  const diversityText = buildDiversityText();

  const excludeText = excludeRecipes.length > 0
    ? `\n\n## TEKRAR ÖNERME:\nŞu tarifleri kesinlikle önerme (yakın zamanda önerildi): ${excludeRecipes.join(', ')}`
    : '';

  const systemInstruction = `Sen "Fridge Chef" uygulamasının akıllı mutfak asistanısın.

## KRİTİK KURAL 1 — Guardrail:
Gönderilen görsel gıda malzemesi DEĞİLSE sadece şunu döndür: {"error": "ERROR_NON_FOOD"}

## KRİTİK KURAL 2 — Çıktı Formatı (STRICT JSON):
SADECE aşağıdaki formatta bir JSON dizisi döndür. Markdown, açıklama veya ekstra metin YAZMA:
[
  {
    "tarifAdi": "string",
    "hazirlikSuresi": "string (örn: '20 dakika')",
    "kaloriTahmini": "string (örn: '~320 kcal')",
    "zorlukSeviyesi": "Kolay" | "Orta" | "Zor",
    "mutfakTuru": "string",
    "kisaAciklama": "string (1-2 cümle)",
    "kategori": "Kahvaltı" | "Öğle" | "Akşam" | "Atıştırmalık" | "Tatlı" | "Çorba" | "Salata" | "Diğer"
  }
]

## KRİTİK KURAL 3 — 10 Farklı Seçenek:
Tam olarak 10 adet tarif seçeneği üret. Her biri birbirinden FARKLI olsun:
- Farklı pişirme teknikleri
- Farklı mutfak kültürleri
- Farklı kategoriler (sabah, öğle, akşam, tatlı vb.)
- Aynı malzemelerle bile çok farklı tarifler mümkündür

## KRİTİK KURAL 4 — Dil: ${getLanguageName(userProfile?.language)}${prefsText}${diversityText}${excludeText}`;

  const userPrompt = `Bu fotoğraftaki malzemeleri analiz et. Bu malzemeleri kullanarak hazırlanabilecek 10 FARKLI tarif seçeneği sun. Mümkün olduğunca çeşitli ol — farklı mutfaklar, farklı pişirme yöntemleri.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        ],
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 1.1,  // Yüksek çeşitlilik
      topP: 0.95,
    },
  });

  if (!response.text) throw new Error('Gemini API boş yanıt döndürdü.');

  let parsed: unknown;
  try {
    parsed = safeParseJson(response.text);
  } catch {
    console.error('[GeminiService] JSON parse hatası (options):', response.text);
    throw new Error('Tarif seçenekleri işlenemedi. Lütfen tekrar deneyin.');
  }

  // Hata kontrolü
  if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
    const err = parsed as { error: string };
    if (err.error === 'ERROR_NON_FOOD') throw new NonFoodImageError();
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Geçersiz tarif seçeneği formatı.');
  }

  return (parsed as RecipeOption[]).slice(0, 10);
};

// ============================================================
// FONKSİYON 2: Seçilen Tarifi Detaylı Getir
// ============================================================
/**
 * Kullanıcının seçtiği tarif adı + mevcut malzemelere göre
 * tam detaylı tarif üretir. (Aşama 2 — Görsel tekrar gönderilir)
 */
export const getFullRecipeBySelection = async (
  selectedOption: RecipeOption,
  base64Image?: string,
  identifiedItems?: string,
  userProfile?: UserProfile
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(userProfile);

  const systemInstruction = `Sen "Fridge Chef" uygulamasının akıllı mutfak asistanısın.

## KRİTİK KURAL 1 — Çıktı Formatı (STRICT JSON):
SADECE aşağıdaki JSON nesnesini döndür. Markdown, açıklama YAZMA:
{
  "tarifAdi": "string",
  "hazirlikSuresi": "string",
  "kaloriTahmini": "string",
  "kullanilanMalzemeler": ["string"],
  "eksikMalzemeler": ["string"],
  "adimAdimYapilisi": ["string (detaylı adım)"],
  "ipuclari": "string (şef notu)",
  "besinDegerleri": {
    "protein": "string (örn: '~28g')",
    "karbonhidrat": "string (örn: '~45g')",
    "yag": "string (örn: '~12g')"
  },
  "kategori": "Kahvaltı" | "Öğle" | "Akşam" | "Atıştırmalık" | "Tatlı" | "Çorba" | "Salata" | "Diğer",
  "zorlukSeviyesi": "Kolay" | "Orta" | "Zor",
  "mutfakTuru": "string",
  "porsiyonSayisi": 2
}

## KRİTİK KURAL 2 — eksikMalzemeler:
Görseldeki malzemeleri analiz et. Tarif için gerekli ancak GÖRSELDE BULUNMAYAN malzemeleri listele.

## KRİTİK KURAL 3 — adimAdimYapilisi:
En az 5, en fazla 12 detaylı adım. Her adım açık ve anlaşılır olsun. Pişirme sürelerini dakika cinsinden belirt.

## KRİTİK KURAL 4 — Dil: ${getLanguageName(userProfile?.language)}${prefsText}`;

  const userPrompt = base64Image
    ? `Fotoğraftaki malzemeleri kullanarak "${selectedOption.tarifAdi}" tarifini detaylı olarak hazırla. Bu tarif ${selectedOption.mutfakTuru} mutfağından olmalı. Tüm alanları eksiksiz doldur.`
    : `Aşağıdaki malzemeleri kullanarak "${selectedOption.tarifAdi}" tarifini detaylı olarak hazırla: ${identifiedItems}. Bu tarif ${selectedOption.mutfakTuru} mutfağından olmalı. Tüm alanları eksiksiz doldur.`;

  const contents: any[] = [
    {
      role: 'user',
      parts: [
        { text: userPrompt },
      ],
    },
  ];

  if (base64Image) {
    contents[0].parts.push({ inlineData: { data: base64Image, mimeType: 'image/jpeg' } });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.7,
      topP: 0.9,
    },
  });

  if (!response.text) throw new Error('Gemini API boş yanıt döndürdü.');

  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseJson(response.text) as Record<string, unknown>;
  } catch {
    console.error('[GeminiService] JSON parse hatası (detail):', response.text);
    throw new Error('Tarif verisi işlenemedi. Lütfen tekrar deneyin.');
  }

  return normalizeRecipe(parsed);
};

// ============================================================
// FONKSİYON 3: Görsel → Direkt Tarif (eski uyumluluk + çeşitlilik)
// ============================================================
/**
 * Favoriler/Geçmiş'ten değil, direkt yeni görsel ile tarif üretir.
 * Artık kullanılmıyor (recipe-picker üzerinden geçildi) ama
 * zero-waste ve diğer akışlar için saklanıyor.
 */
export const getRecipeFromImage = async (
  base64Image: string,
  userProfile?: UserProfile
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(userProfile);
  const diversityText = buildDiversityText();

  const systemInstruction = `Sen "Fridge Chef" uygulamasının akıllı mutfak asistanısın.

## KRİTİK KURAL 1 — Guardrail:
Görsel gıda değilse sadece döndür: {"error": "ERROR_NON_FOOD"}

## KRİTİK KURAL 2 — Çıktı Formatı (STRICT JSON):
{
  "tarifAdi": "string",
  "hazirlikSuresi": "string",
  "kaloriTahmini": "string",
  "kullanilanMalzemeler": ["string"],
  "eksikMalzemeler": ["string"],
  "adimAdimYapilisi": ["string"],
  "ipuclari": "string",
  "besinDegerleri": { "protein": "string", "karbonhidrat": "string", "yag": "string" },
  "kategori": "Kahvaltı" | "Öğle" | "Akşam" | "Atıştırmalık" | "Tatlı" | "Çorba" | "Salata" | "Diğer",
  "zorlukSeviyesi": "Kolay" | "Orta" | "Zor",
  "mutfakTuru": "string",
  "porsiyonSayisi": 2
}

## KRİTİK KURAL 3 — Dil: ${getLanguageName(userProfile?.language)}${prefsText}${diversityText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: 'Bu fotoğraftaki malzemeleri analiz et ve yaratıcı bir tarif öner.' },
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } },
        ],
      },
    ],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 1.1,
      topP: 0.95,
    },
  });

  if (!response.text) throw new Error('Gemini API boş yanıt döndürdü.');

  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseJson(response.text) as Record<string, unknown>;
  } catch {
    console.error('[GeminiService] JSON parse hatası:', response.text);
    throw new Error('Tarif verisi işlenemedi. Lütfen tekrar deneyin.');
  }

  if (parsed.error === 'ERROR_NON_FOOD') throw new NonFoodImageError();

  return normalizeRecipe(parsed);
};

// ============================================================
// FONKSİYON 4: Sıfır Atık Tarifi (Pantry → Metin Tabanlı)
// ============================================================
export const getZeroWasteRecipeFromPantry = async (
  expiringItems: string[],
  allPantryItems: string[],
  userProfile?: UserProfile
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(userProfile);
  const diversityText = buildDiversityText();

  const zeroWasteInstruction = `Sen "Fridge Chef" uygulamasının Sıfır Atık (Zero Waste) mutfak asistanısın.
Görevin: Kullanıcının kilerindeki, ÖNCELiKLE SON TÜKETİM TARİHİ YAKLAŞAN malzemeleri kullanarak lezzetli ve pratik bir tarif oluşturmak.

## KRİTİK KURAL 1 — Öncelik Sırası:
1. Önce bozulmak üzere olan malzemeleri kullan: ${expiringItems.join(', ') || 'yok'}
2. Sonra kilerdeki diğer malzemeleri kullan: ${allPantryItems.join(', ') || 'yok'}

## KRİTİK KURAL 2 — Çıktı Formatı (Strict JSON):
{
  "tarifAdi": "string",
  "hazirlikSuresi": "string",
  "kaloriTahmini": "string",
  "kullanilanMalzemeler": ["string"],
  "eksikMalzemeler": ["string"],
  "adimAdimYapilisi": ["string"],
  "ipuclari": "string",
  "besinDegerleri": { "protein": "string", "karbonhidrat": "string", "yag": "string" },
  "kategori": "Kahvaltı" | "Öğle" | "Akşam" | "Atıştırmalık" | "Tatlı" | "Çorba" | "Salata" | "Diğer",
  "zorlukSeviyesi": "Kolay" | "Orta" | "Zor",
  "mutfakTuru": "string",
  "porsiyonSayisi": 2
}

## KRİTİK KURAL 3 — Dil: ${getLanguageName(userProfile?.language)}${prefsText}${diversityText}`;

  const userPrompt = `Kilerimde şu malzemeler bozulmak üzere: ${
    expiringItems.length > 0 ? expiringItems.join(', ') : 'belirtilmedi'
  }. Tüm kiler içeriğim: ${
    allPantryItems.length > 0 ? allPantryItems.join(', ') : 'belirtilmedi'
  }. Bu malzemeleri önceliklendirerek bana bir Sıfır Atık tarifi öner.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: zeroWasteInstruction,
      responseMimeType: 'application/json',
      temperature: 1.0,
    },
  });

  if (!response.text) throw new Error('Gemini API boş yanıt döndürdü.');

  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseJson(response.text) as Record<string, unknown>;
  } catch {
    throw new Error('Sıfır Atık tarifi işlenemedi. Lütfen tekrar deneyin.');
  }

  return normalizeRecipe(parsed);
};

// ============================================================
// AI ASİSTAN VEYA METİN ARAMA İLE DETAYLI TARİF OLUŞTURMA
// ============================================================
export const getRecipeFromText = async (
  recipeName: string,
  userProfile?: UserProfile
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(userProfile);

  const systemInstruction = `Sen "Fridge Chef" uygulamasının akıllı mutfak asistanısın.
Kullanıcının talep ettiği "${recipeName}" yemeği için detaylı ve lezzetli bir tarif oluştur.

## KRİTİK KURAL 1 — Çıktı Formatı (STRICT JSON):
SADECE aşağıdaki formatta bir JSON nesnesi döndür. Markdown veya ekstra açıklama metni YAZMA:
{
  "tarifAdi": "string",
  "hazirlikSuresi": "string",
  "kaloriTahmini": "string",
  "kullanilanMalzemeler": ["string"],
  "eksikMalzemeler": ["string"],
  "adimAdimYapilisi": ["string (detaylı adım)"],
  "ipuclari": "string (şef notu)",
  "besinDegerleri": {
    "protein": "string (örn: '~28g')",
    "karbonhidrat": "string (örn: '~45g')",
    "yag": "string (örn: '~12g')"
  },
  "kategori": "Kahvaltı" | "Öğle" | "Akşam" | "Atıştırmalık" | "Tatlı" | "Çorba" | "Salata" | "Diğer",
  "zorlukSeviyesi": "Kolay" | "Orta" | "Zor",
  "mutfakTuru": "string",
  "porsiyonSayisi": 2
}

## KRİTİK KURAL 2 — adimAdimYapilisi:
En az 5, en fazla 12 detaylı adım. Her adım açık ve anlaşılır olsun. Pişirme sürelerini dakika cinsinden belirt.

## KRİTİK KURAL 3 — Dil: ${getLanguageName(userProfile?.language)}${prefsText}`;

  const userPrompt = `"${recipeName}" tarifini detaylı olarak hazırla. Tüm alanları eksiksiz doldur.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.7,
      topP: 0.9,
    },
  });

  if (!response.text) throw new Error('Gemini API boş yanıt döndürdü.');

  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseJson(response.text) as Record<string, unknown>;
  } catch {
    console.error('[GeminiService] JSON parse hatası (getRecipeFromText):', response.text);
    throw new Error('Tarif verisi işlenemedi. Lütfen tekrar deneyin.');
  }

  return normalizeRecipe(parsed);
};

// ============================================================
// FAZ 4 — HIZLI ATIŞTIRMALIK MODU (3 malzeme, max 5 dk)
// ============================================================
export const getQuickSnackRecipes = async (
  pantryItems: string[],
  prefs?: UserProfile
): Promise<RecipeOption[]> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(prefs);
  const instruction = `Sen Fridge Chef uygulamasının hızlı atıştırmalık asistanısın.
Kullanıcı elindeki malzemelerle MAXIMUM 5 DAKİKADA hazırlanabilecek,
en fazla 3 ana malzeme kullanan pratik atıştırmalık/kahvaltı önerileri istiyor.
10 farklı seçenek döndür. Her biri hazırlanması gerçekten çabuk ve kolay olmalı.
JSON array formatında, her eleman şu alanları içermeli:
tarifAdi, hazirlikSuresi (örn "3 dk"), kaloriTahmini, zorlukSeviyesi ("Kolay"),
mutfakTuru, kisaAciklama, kategori.
Başka hiçbir şey yazma, sadece JSON.${prefsText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: `Kilerimdeki malzemeler: ${pantryItems.join(', ') || 'temel mutfak malzemeleri'}. Hızlı atıştırmalık öner.` }] }],
    config: { systemInstruction: instruction, responseMimeType: 'application/json', temperature: 0.9 },
  });

  if (!response.text) throw new Error('Boş yanıt');
  const parsed = safeParseJson(response.text);
  return parsed as RecipeOption[];
};

// ============================================================
// FAZ 4 — ŞANSIMA PİŞİR (Rastgele Yaratıcı Tarif)
// ============================================================
export const getLuckyRecipe = async (
  pantryItems: string[],
  prefs?: UserProfile
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(prefs);
  const wildCuisine = pickRandom([...CUISINE_POOL, 'Füzyon', 'Meksika-Japon', 'Akdeniz-Asya']);
  const wildTechnique = pickRandom([...TECHNIQUE_POOL, 'tütsüleme', 'fermente etme']);

  const instruction = `Sen Fridge Chef'in "Şansıma Pişir" modusundasın.
Kullanıcı tamamen sürpriz, yaratıcı ve farklı bir şey denemek istiyor.
${wildCuisine} mutfağından ilham al, ${wildTechnique} tekniğini kullan.
Klişelerden kaçın. Alışılmadık ama lezzetli bir tarif üret.
Tek bir tarif dön, JSON formatında (Recipe objesi).${prefsText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: `Kilerimdeki malzemeler: ${pantryItems.join(', ') || 'temel mutfak malzemeleri'}. Şansıma pişir!` }] }],
    config: { systemInstruction: instruction, responseMimeType: 'application/json', temperature: 1.2 },
  });

  if (!response.text) throw new Error('Boş yanıt');
  const parsed = safeParseJson(response.text) as Record<string, unknown>;
  return normalizeRecipe(parsed);
};


// ============================================================
// FAZ 4 — ARTAN YEMEK DEĞERLENDİRİCİ (Leftover Magic)
// ============================================================
export const getLeftoverRecipes = async (
  leftovers: string[],
  pantryItems: string[],
  prefs?: UserProfile
): Promise<RecipeOption[]> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(prefs);
  const instruction = `Sen Fridge Chef'in "Artık Yemek Değerlendirici" asistanısın.
Kullanıcının artan yemeklerini ve kiler malzemelerini kullanarak yepyeni tarifler öner.
Artan yemekleri değerlendirmek için yaratıcı ol (kroket, börek, çorba, fırın yemeği vb.).
10 seçenek döndür, JSON array formatında (RecipeOption listesi).
Her biri şu alanları içermeli: tarifAdi, hazirlikSuresi, kaloriTahmini, zorlukSeviyesi, mutfakTuru, kisaAciklama, kategori.${prefsText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: `Artan yemeklerim: ${leftovers.join(', ')}. Diğer malzemelerim: ${pantryItems.join(', ')}. Bu artıklarla ne yapabilirim?` }] }],
    config: { systemInstruction: instruction, responseMimeType: 'application/json', temperature: 1.0 },
  });

  if (!response.text) throw new Error('Boş yanıt');
  return safeParseJson(response.text) as RecipeOption[];
};


// ============================================================
// FAZ 4 — MİSAFİR MODU (Çoklu Kısıtlama)
// ============================================================
export const getGuestFriendlyRecipes = async (
  pantryItems: string[],
  guestRestrictions: { name: string; restrictions: string[] }[],
  prefs?: UserProfile
): Promise<RecipeOption[]> => {
  const ai = getAiClient();
  const guestText = guestRestrictions
    .map((g) => `${g.name}: ${g.restrictions.join(', ')}`)
    .join('\n');
  const instruction = `Sen Fridge Chef'in misafir modu asistanısın.
Ev sahibi birden fazla misafiri olan bir akşam yemeği planlıyor.
Aşağıdaki misafir kısıtlamalarını DİKKATE AL ve HERKESİN yiyebileceği yemekler öner.
Misafir kısıtlamaları:\n${guestText}
10 tarif seçeneği döndür, JSON array formatında (RecipeOption listesi).
Her biri: tarifAdi, hazirlikSuresi, kaloriTahmini, zorlukSeviyesi, mutfakTuru, kisaAciklama, kategori.
${buildUserPreferencesText(prefs)}`;
  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: `Elimdeki malzemeler: ${pantryItems.join(', ')}. Misafirlerim için uygun tarif öner.` }] }],
    config: { systemInstruction: instruction, responseMimeType: 'application/json', temperature: 0.9 },
  });

  if (!response.text) throw new Error('Boş yanıt');
  return safeParseJson(response.text) as RecipeOption[];
};

// ============================================================
// FONKSİYON 9: Malzeme İkame (Substitute) Bulucu
// ============================================================
export const getIngredientSubstitution = async (
  ingredient: string,
  pantryItems: string[],
  prefs?: UserProfile
): Promise<string[]> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(prefs);
  const prompt = `Şu an elimde "${ingredient}" yok.
  Mevcut kilerimde şunlar var: ${pantryItems.join(', ')}.
  Kilerimdeki malzemelerden veya genel mutfak malzemelerinden hangisi ile ikame edebilirim?
  Bana en mantıklı 3 ikameyi sun. SADECE bir JSON dizisi dön. Örnek format:
  ["1 yemek kaşığı tereyağı yerine 1 yemek kaşığı zeytinyağı", "Süt yerine yoğurt sulandırarak"]
  
  Kullanıcı tercihleri: ${prefsText}`;

  const res = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.2,
    },
  });

  try {
    const data = safeParseJson(res.text ?? '[]');
    if (Array.isArray(data)) return data as string[];
    return [];
  } catch {
    return [];
  }
};
// ============================================================
// FONKSİYON 11: Tarifi Kişiselleştir (Kullanıcı İsteğiyle Değiştir)
// ============================================================
export const customizeRecipe = async (
  currentRecipe: Recipe,
  customizationRequest: string,
  prefs?: UserProfile
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(prefs);
  const prompt = `Aşağıdaki tarifi kullanıcının şu isteğine göre YENİDEN YAZ: "${customizationRequest}"
  
MEVCUT TARİF:
${JSON.stringify(currentRecipe, null, 2)}

SADECE güncellenmiş tarifi STRICT JSON formatında dön. (Yepyeni bir tarif gibi tam formatlı olmalı)
Aynı yapıyı (Recipe nesnesi) kullan.

Kullanıcı Tercihleri: ${prefsText}`;

  const res = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  if (!res.text) throw new Error('Boş yanıt');
  const data = safeParseJson(res.text) as Record<string, unknown>;
  return normalizeRecipe(data);
};

// ============================================================
// FONKSİYON 10: Fiş/Fatura Analizi (Receipt OCR)
// ============================================================
export const extractFoodItemsFromReceipt = async (
  base64Image: string
): Promise<string[]> => {
  const ai = getAiClient();
  const prompt = `Bu fotoğrafta bir alışveriş fişi veya faturası var.
Lütfen sadece GIDA ve YİYECEK/İÇECEK ürünlerini tespit et (deterjan, kıyafet, elektronik vb. çıkarma).
SADECE bir JSON dizisi dön. Eğer ürün bulamazsan veya okunmuyorsa boş dizi dön [].
Örnek: ["Süt", "Yumurta", "Domates", "Makarna"]`;

  const res = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { data: base64Image, mimeType: 'image/jpeg' } }
        ],
      },
    ],
    config: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  try {
    const data = safeParseJson(res.text ?? '[]');
    if (Array.isArray(data)) return data as string[];
    return [];
  } catch {
    return [];
  }
};

