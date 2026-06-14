// ============================================================
// Fridge Chef — Gemini AI Servisi (Production-Ready)
// ============================================================
// Özellikler:
//  1. Kısıtlayıcı System Instruction (Guardrail)
//  2. Non-food görsel → ERROR_NON_FOOD kodu → NonFoodImageError
//  3. Strict JSON çıktısı (parse güvenli)
//  4. Kullanıcı diyet/alerji tercihlerini prompt'a enjekte eder
//  5. eksikMalzemeler → Alışveriş listesi entegrasyonu
// ============================================================

import { GoogleGenAI } from '@google/genai';
import { NonFoodImageError, Recipe, UserPreferences } from '../types';

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

// ── System Instruction (Sistem Komutu) ──────────────────────
// Bu metin Gemini'nin "kişiliğini" ve kısıtlamalarını belirler.
// Hiçbir koşulda bu kuralların dışına çıkmaması istenir.
const SYSTEM_INSTRUCTION = `Sen "Fridge Chef" uygulamasının akıllı mutfak asistanısın. Görevin, kullanıcıların buzdolabı veya gıda malzemesi fotoğraflarını analiz edip kişiselleştirilmiş yemek tarifleri üretmek.

## KRİTİK KURAL 1 — Guardrail (Non-Food Tespiti):
Gönderilen görsel bir yemek, buzdolabı içi, mutfak tezgahı veya herhangi bir GİDA MALZEMESİ DEĞİLSE:
- Kesinlikle tarif üretme.
- Sadece şu JSON nesnesini döndür, başka hiçbir şey yazma:
  {"error": "ERROR_NON_FOOD"}

## KRİTİK KURAL 2 — Çıktı Formatı:
Yanıtın HER ZAMAN aşağıdaki JSON şemasına uygun olmalıdır. Markdown code block (\`\`\`json) KULLANMA. Düz JSON döndür:
{
  "tarifAdi": "string",
  "hazirlikSuresi": "string (örn: '25 dakika')",
  "kaloriTahmini": "string (örn: '~380 kcal / porsiyon')",
  "kullanilanMalzemeler": ["string"],
  "eksikMalzemeler": ["string"],
  "adimAdimYapilisi": ["string"],
  "ipuclari": "string (opsiyonel şef notu)"
}

## KRİTİK KURAL 3 — eksikMalzemeler:
Görseldeki malzemeleri analiz et. Önerdiğin tarif için gerekli olan ancak GÖRSELDE BULUNMAYAN malzemeleri "eksikMalzemeler" dizisine ekle.
Eğer tüm malzemeler mevcut ise "eksikMalzemeler" boş dizi [] olarak dönsün.

## KRİTİK KURAL 4 — Tek Tarif:
Her istekte yalnızca 1 (bir) adet tarif üret. En lezzetli ve en pratik olanı seç.

## KRİTİK KURAL 5 — Dil:
Tüm yanıtları Türkçe ver. Tarif adları, malzemeler ve adımlar Türkçe olmalıdır.`;

// ── Kullanıcı Tercihlerini Prompt'a Enjekte Et ───────────────
const buildUserPreferencesText = (prefs?: UserPreferences): string => {
  if (!prefs) return '';

  const parts: string[] = [];

  if (prefs.dietaryRestrictions && prefs.dietaryRestrictions.length > 0) {
    parts.push(`Diyet Kısıtlamaları: ${prefs.dietaryRestrictions.join(', ')}`);
  }

  if (prefs.allergies && prefs.allergies.length > 0) {
    parts.push(`Alerjiler (KESİNLİKLE KULLANMA): ${prefs.allergies.join(', ')}`);
  }

  if (parts.length === 0) return '';

  return `\n\n## KULLANICI TERCİHLERİ (ZORUNLU — Bu kurallara kesinlikle uy):\n${parts.join('\n')}`;
};

// ── Gemini'den Gelen Metni Güvenli Parse Et ─────────────────
const safeParseJson = (text: string): unknown => {
  // Gemini bazen markdown code block içinde döndürebilir, temizle
  const cleaned = text
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  return JSON.parse(cleaned);
};

// ── Ana Fonksiyon: Görselden Tarif Al ────────────────────────
/**
 * Base64 formatındaki görsel ile Gemini API'ye istek gönderir.
 * @param base64Image - Sıkıştırılmış JPEG görsel (image-manipulator çıktısı)
 * @param userPreferences - Kullanıcının diyet ve alerji tercihleri (opsiyonel)
 * @returns Tarif nesnesi (Recipe)
 * @throws NonFoodImageError - Görsel gıda değilse
 * @throws Error - Genel API hatası
 */
export const getRecipeFromImage = async (
  base64Image: string,
  userPreferences?: UserPreferences
): Promise<Recipe> => {
  const ai = getAiClient();

  // Kullanıcı tercihlerini sistem komutuna ekle
  const fullSystemInstruction =
    SYSTEM_INSTRUCTION + buildUserPreferencesText(userPreferences);

  // Kullanıcı tarafından gönderilen ana mesaj
  const userPrompt = `Bu fotoğraftaki gıda malzemelerini analiz et ve bana bir tarif öner.${buildUserPreferencesText(userPreferences)}`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: userPrompt },
          {
            inlineData: {
              data: base64Image,
              mimeType: 'image/jpeg',
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: fullSystemInstruction,
      responseMimeType: 'application/json',
      temperature: 0.7, // Yaratıcı ama tutarlı
      topP: 0.9,
    },
  });

  if (!response.text) {
    throw new Error('Gemini API boş yanıt döndürdü.');
  }

  // JSON parse
  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseJson(response.text) as Record<string, unknown>;
  } catch {
    console.error('[GeminiService] JSON parse hatası. Ham yanıt:', response.text);
    throw new Error('Tarif verisi işlenemedi. Lütfen tekrar deneyin.');
  }

  // ── Guardrail Kontrolü ────────────────────────────────────
  if (parsed.error === 'ERROR_NON_FOOD') {
    throw new NonFoodImageError();
  }

  // ── Temel Alan Doğrulaması ────────────────────────────────
  const requiredFields = [
    'tarifAdi',
    'hazirlikSuresi',
    'kaloriTahmini',
    'kullanilanMalzemeler',
    'eksikMalzemeler',
    'adimAdimYapilisi',
  ];

  for (const field of requiredFields) {
    if (!(field in parsed)) {
      console.error(`[GeminiService] Eksik alan: ${field}`, parsed);
      throw new Error(`Tarif verisi eksik (${field}). Lütfen tekrar deneyin.`);
    }
  }

  // Dizi alanlarının gerçekten dizi olduğunu doğrula
  const arrayFields = ['kullanilanMalzemeler', 'eksikMalzemeler', 'adimAdimYapilisi'];
  for (const field of arrayFields) {
    if (!Array.isArray(parsed[field])) {
      (parsed as Record<string, unknown>)[field] = [];
    }
  }

  return parsed as unknown as Recipe;
};

// ── Sıfır Atık Tarifi (Pantry → Metin Tabanlı) ──────────────────
/**
 * Kilerdeki bozulmak üzere olan malzemeleri önceliklendirerek
 * görsel gerektirmeden metin tabanlı tarif üretir.
 */
export const getZeroWasteRecipeFromPantry = async (
  expiringItems: string[],
  allPantryItems: string[],
  userPreferences?: UserPreferences
): Promise<Recipe> => {
  const ai = getAiClient();
  const prefsText = buildUserPreferencesText(userPreferences);

  const zeroWasteInstruction = `Sen "Fridge Chef" uygulamasının Sıfır Atık (Zero Waste) mutfak asistanısın.
Görevin: Kullanıcının kilerindeki, ÖNCELiKLE SON TÜKETİM TARİHİ YAKLAŞAN malzemeleri kullanarak lezzetli ve pratik bir tarif oluşturmak.

## KRİTİK KURAL 1 — Öncelik Sırası:
1. Önce bozulmak üzere olan malzemeleri kullan: ${expiringItems.join(', ') || 'yok'}
2. Sonra kilerdeki diğer malzemeleri kullan: ${allPantryItems.join(', ') || 'yok'}
3. Tarifi bu malzemelere göre uyarla — rastgele malzeme uydurma

## KRİTİK KURAL 2 — Çıktı Formatı (Strict JSON):
Yanıtın SADECE aşağıdaki JSON şemasına uygun olmalı. Markdown veya açıklama ekleme:
{
  "tarifAdi": "string",
  "hazirlikSuresi": "string",
  "kaloriTahmini": "string",
  "kullanilanMalzemeler": ["string"],
  "eksikMalzemeler": ["string"],
  "adimAdimYapilisi": ["string"],
  "ipuclari": "string"
}

## KRİTİK KURAL 3 — eksikMalzemeler:
Tarif için gerekli ancak kullanıcının kilerinde BULUNMAYAN malzemeleri "eksikMalzemeler" dizisine ekle.

## KRİTİK KURAL 4 — Sıfır Atık Notu:
"ipuclari" alanına bozulmak üzere olan malzemelerin bu tarifte neden kullanıldığını kısaca belirt.

## KRİTİK KURAL 5 — Dil: Türkçe${prefsText}`;

  const userPrompt = `Kilerimde şu malzemeler bozulmak üzere: ${
    expiringItems.length > 0 ? expiringItems.join(', ') : 'belirtilmedi'
  }. Tüm kiler içeriğim: ${
    allPantryItems.length > 0 ? allPantryItems.join(', ') : 'belirtilmedi'
  }. Bu malzemeleri önceliklendirerek bana bir Sıfır Atık tarifi öner.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
    config: {
      systemInstruction: zeroWasteInstruction,
      responseMimeType: 'application/json',
      temperature: 0.75,
    },
  });

  if (!response.text) throw new Error('Gemini API boş yanıt döndürdü.');

  let parsed: Record<string, unknown>;
  try {
    parsed = safeParseJson(response.text) as Record<string, unknown>;
  } catch {
    throw new Error('Sıfır Atık tarifi işlenemedi. Lütfen tekrar deneyin.');
  }

  const arrayFields = ['kullanilanMalzemeler', 'eksikMalzemeler', 'adimAdimYapilisi'];
  for (const field of arrayFields) {
    if (!Array.isArray(parsed[field])) {
      (parsed as Record<string, unknown>)[field] = [];
    }
  }

  return parsed as unknown as Recipe;
};
