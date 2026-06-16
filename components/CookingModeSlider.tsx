// ============================================================
// Fridge Chef — Pişirme Modu (Hands-Free Cooking Mode)
// ============================================================
// Özellikler:
//  • Her adım tam ekran kaplayan devasa bir kart
//  • Yatay kaydırma (swipe) ile adımlar arasında geçiş
//  • Çok büyük fontlar — mutfakta uzaktan okunabilir
//  • Ekran uyanık kalır (expo-keep-awake)
//  • Adım numarası, ilerleme çubuğu, önceki/sonraki butonları
//  • Koyu, immersive arka plan — parlak ekranda net görünür
//  • 🎤 Sesli Komut: "geç/sonraki/ileri" → sonraki adım,
//    "geri/önceki" → önceki adım
// ============================================================

import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
  Modal,
  StatusBar,
  ViewToken,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';
import { LinearGradient } from 'expo-linear-gradient';

// ── Expo Go uyumlu güvenli speech recognition yükleme ────────
// expo-speech-recognition native bir modül gerektirir ve
// Expo Go'da çalışmaz. try/catch ile graceful fallback sağlıyoruz.
type SpeechEvent = 'result' | 'end' | 'error';
type SpeechEventHandler = (event: any) => void;

let _speechAvailable = false;
let _SpeechModule: {
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  start: (opts: object) => void;
  stop: () => void;
} = {
  requestPermissionsAsync: async () => ({ granted: false }),
  start: () => {},
  stop: () => {},
};
let _useSpeechEvent: (event: SpeechEvent, handler: SpeechEventHandler) => void =
  () => {}; // no-op hook stub (hook kurallarını korur)

try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const sre = require('expo-speech-recognition');
  _SpeechModule = sre.ExpoSpeechRecognitionModule;
  _useSpeechEvent = sre.useSpeechRecognitionEvent;
  _speechAvailable = true;
} catch {
  _speechAvailable = false;
}

const ExpoSpeechRecognitionModule = _SpeechModule;
const useSpeechRecognitionEvent = _useSpeechEvent;
const SPEECH_AVAILABLE = _speechAvailable;


const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// ── Renk Paleti (Koyu mod — mutfak için) ─────────────────────
const COOKING_COLORS = {
  bg: '#0F0F1A',          // Koyu lacivert arka plan
  cardBg: '#1A1A2E',      // Kart arka planı
  accent: '#FF8C00',       // Turuncu vurgu
  accentLight: '#FFB347',
  textPrimary: '#FFFFFF',
  textSecondary: 'rgba(255,255,255,0.7)',
  textMuted: 'rgba(255,255,255,0.4)',
  progressBg: 'rgba(255,255,255,0.15)',
  progressFill: '#FF8C00',
  navButton: 'rgba(255,255,255,0.1)',
  navButtonBorder: 'rgba(255,255,255,0.2)',
  micActive: '#4CAF50',
  micInactive: 'rgba(255,255,255,0.3)',
};

// ── Sesli komut anahtar kelimeleri ───────────────────────────
const NEXT_KEYWORDS = ['geç', 'gec', 'sonraki', 'ileri', 'next', 'devam'];
const PREV_KEYWORDS = ['geri', 'önceki', 'onceki', 'previous', 'back'];

// ── Tipler ───────────────────────────────────────────────────
interface CookingModeSliderProps {
  visible: boolean;
  recipeName: string;
  steps: string[];
  onClose: () => void;
}

// ── Tek Adım Kartı ────────────────────────────────────────────
interface StepCardProps {
  step: string;
  stepNumber: number;
  totalSteps: number;
}

// ── Adım Metninden Süre Tespit Et ─────────────────────────────
const extractMinutes = (text: string): number | null => {
  // "15 dakika", "2 saat", "30 saniye" gibi ifadeleri yakala
  const dakikaMatch = text.match(/(\d+)\s*dakika/i);
  const saatMatch = text.match(/(\d+)\s*saat/i);
  const saniyeMatch = text.match(/(\d+)\s*saniye/i);
  if (saatMatch) return parseInt(saatMatch[1], 10) * 60;
  if (dakikaMatch) return parseInt(dakikaMatch[1], 10);
  if (saniyeMatch) return Math.ceil(parseInt(saniyeMatch[1], 10) / 60) || 1;
  return null;
};

function StepCard({ step, stepNumber, totalSteps }: StepCardProps) {
  const detectedMinutes = extractMinutes(step);
  const [timerSeconds, setTimerSeconds] = React.useState<number | null>(null);
  const [timerRunning, setTimerRunning] = React.useState(false);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer temizle: adım değişince
  React.useEffect(() => {
    setTimerSeconds(null);
    setTimerRunning(false);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, [stepNumber]);

  React.useEffect(() => {
    if (timerRunning && timerSeconds !== null) {
      intervalRef.current = setInterval(() => {
        setTimerSeconds((prev) => {
          if (prev === null || prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimerRunning(false);
            Alert.alert('⏰ Süre Doldu!', `Adım ${stepNumber} tamamlandı!`);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [timerRunning]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const startTimer = () => {
    if (detectedMinutes) {
      setTimerSeconds(detectedMinutes * 60);
      setTimerRunning(true);
    }
  };

  return (
    <View style={stepStyles.container}>
      {/* Adım Numarası Rozetı */}
      <View style={stepStyles.stepBadgeRow}>
        <LinearGradient
          colors={[COOKING_COLORS.accent, COOKING_COLORS.accentLight]}
          style={stepStyles.stepBadge}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={stepStyles.stepBadgeText}>Adım {stepNumber}</Text>
        </LinearGradient>
        <Text style={stepStyles.stepCountText}>/ {totalSteps}</Text>
      </View>

      {/* Adım Metni — Devasa Font */}
      <View style={stepStyles.textContainer}>
        <ScrollView
          style={{ width: '100%' }}
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          showsVerticalScrollIndicator={true}
        >
          <Text style={stepStyles.stepText}>{step}</Text>
        </ScrollView>
      </View>

      {/* Timer — sadece süre tespit edildiyse göster */}
      {detectedMinutes && (
        <View style={stepStyles.timerContainer}>
          {timerSeconds !== null ? (
            <>
              <Text style={stepStyles.timerDisplay}>
                {formatTime(timerSeconds)}
              </Text>
              <View style={stepStyles.timerButtons}>
                <TouchableOpacity
                  style={[stepStyles.timerBtn, timerRunning ? stepStyles.timerBtnPause : stepStyles.timerBtnStart]}
                  onPress={() => setTimerRunning((r) => !r)}
                >
                  <Ionicons name={timerRunning ? 'pause' : 'play'} size={20} color="white" />
                  <Text style={stepStyles.timerBtnText}>{timerRunning ? 'Durdur' : 'Devam'}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={stepStyles.timerBtnReset}
                  onPress={() => { setTimerSeconds(detectedMinutes * 60); setTimerRunning(false); }}
                >
                  <Ionicons name="refresh" size={18} color={COOKING_COLORS.accent} />
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <TouchableOpacity style={stepStyles.timerStartBtn} onPress={startTimer}>
              <Ionicons name="timer-outline" size={24} color="#FFFFFF" />
              <Text style={stepStyles.timerStartText}>{detectedMinutes} Dakika Sayacı Başlat ⏱️</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Alt İpucu */}
      <Text style={stepStyles.swipeHint}>
        {stepNumber < totalSteps ? '← Sonraki adım için kaydır →' : '✅ Son adım!'}
      </Text>
    </View>
  );
}

const stepStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 20,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 32,
  },
  stepBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  stepBadge: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 999,
  },
  stepBadgeText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  stepCountText: {
    fontSize: 18,
    color: COOKING_COLORS.textSecondary,
    fontWeight: '500',
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COOKING_COLORS.cardBg,
    borderRadius: 28,
    padding: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  stepText: {
    fontSize: 32,       // Büyük font — mutfaktan okunabilir
    fontWeight: '700',
    color: COOKING_COLORS.textPrimary,
    lineHeight: 48,     // Satır aralığı geniş
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  swipeHint: {
    fontSize: 15,
    color: COOKING_COLORS.textMuted,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  // ── Timer ──────────────────────────────────────────────────
  timerContainer: {
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,140,0,0.12)',
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,140,0,0.3)',
  },
  timerDisplay: {
    fontSize: 52,
    fontWeight: '800',
    color: COOKING_COLORS.accent,
    letterSpacing: 2,
    fontVariant: ['tabular-nums'],
  },
  timerButtons: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  timerBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 20, borderRadius: 30,
  },
  timerBtnStart: { backgroundColor: COOKING_COLORS.accent },
  timerBtnPause: { backgroundColor: '#6B7280' },
  timerBtnText: { color: 'white', fontWeight: '700', fontSize: 15 },
  timerBtnReset: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,140,0,0.15)',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 1, borderColor: COOKING_COLORS.accent,
  },
  timerStartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 22,
    borderRadius: 30, backgroundColor: 'rgba(255,140,0,0.12)',
    borderWidth: 1.5, borderColor: COOKING_COLORS.accent,
  },
  timerStartText: { color: COOKING_COLORS.accent, fontWeight: '700', fontSize: 15 },
});

// ── Ana Bileşen ───────────────────────────────────────────────
export default function CookingModeSlider({
  visible,
  recipeName,
  steps,
  onClose,
}: CookingModeSliderProps) {
  // Ekranı uyanık tut (pişirme süresince)
  useKeepAwake();

  const flatListRef = useRef<FlatList>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // ── Sesli Komut State ──────────────────────────────────────
  const [isListening, setIsListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);

  // currentIndex'i ref ile tut (event handler'lar stale closure sorununu önlemek için)
  const currentIndexRef = useRef(0);
  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  // ── Sesli Tanıma Event'leri ────────────────────────────────
  useSpeechRecognitionEvent('result', (event) => {
    const transcript = event.results?.[0]?.transcript?.toLowerCase().trim();
    if (!transcript) return;

    // Anahtar kelimeleri kontrol et
    const words = transcript.split(/\s+/);
    const lastWord = words[words.length - 1];

    if (NEXT_KEYWORDS.some((kw) => lastWord.includes(kw) || transcript.includes(kw))) {
      setLastCommand('▶ Sonraki');
      const idx = currentIndexRef.current;
      if (idx < steps.length - 1) {
        flatListRef.current?.scrollToIndex({ index: idx + 1, animated: true });
      }
    } else if (PREV_KEYWORDS.some((kw) => lastWord.includes(kw) || transcript.includes(kw))) {
      setLastCommand('◀ Önceki');
      const idx = currentIndexRef.current;
      if (idx > 0) {
        flatListRef.current?.scrollToIndex({ index: idx - 1, animated: true });
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    // Dinleme modundaysa otomatik yeniden başlat
    if (isListening) {
      startListeningInternal();
    }
  });

  useSpeechRecognitionEvent('error', (event) => {
    console.warn('[VoiceCommand] error:', event.error);
    // Bazı hatalar sonrası yeniden başlat
    if (isListening && event.error !== 'no-speech') {
      setTimeout(() => {
        startListeningInternal();
      }, 1000);
    }
  });

  const startListeningInternal = async () => {
    try {
      const result = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!result.granted) {
        setIsListening(false);
        return;
      }
      ExpoSpeechRecognitionModule.start({
        lang: 'tr-TR',
        interimResults: true,
        continuous: false,
      });
    } catch (err) {
      console.warn('[VoiceCommand] start error:', err);
    }
  };

  const toggleListening = async () => {
    if (!SPEECH_AVAILABLE) {
      Alert.alert(
        '🎤 Sesli Komut',
        'Sesli komut özelliği Expo Go\'da desteklenmez. Bu özelliği kullanmak için development build gereklidir.',
        [{ text: 'Tamam' }]
      );
      return;
    }
    if (isListening) {
      // Durdur
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      setLastCommand(null);
    } else {
      // Başlat
      setIsListening(true);
      await startListeningInternal();
    }
  };

  // Modal kapanırken dinlemeyi durdur
  useEffect(() => {
    if (!visible && isListening) {
      ExpoSpeechRecognitionModule.stop();
      setIsListening(false);
      setLastCommand(null);
    }
  }, [visible]);

  // Görünür öğe değiştiğinde index'i güncelle
  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        setCurrentIndex(viewableItems[0].index);
      }
    },
    []
  );

  const viewabilityConfig = { viewAreaCoveragePercentThreshold: 50 };

  // ── Önceki Adım ────────────────────────────────────────────
  const goToPrev = () => {
    if (currentIndex > 0) {
      flatListRef.current?.scrollToIndex({ index: currentIndex - 1, animated: true });
    }
  };

  // ── Sonraki Adım ────────────────────────────────────────────
  const goToNext = () => {
    if (currentIndex < steps.length - 1) {
      flatListRef.current?.scrollToIndex({ index: currentIndex + 1, animated: true });
    }
  };

  const progress = steps.length > 0 ? (currentIndex + 1) / steps.length : 0;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === steps.length - 1;

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="light-content" backgroundColor={COOKING_COLORS.bg} />
      <View style={styles.root}>
        {/* ── Üst Bar ────────────────────────────────────────── */}
        <View style={styles.topBar}>
          {/* Kapat */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color={COOKING_COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Tarif Adı */}
          <Text style={styles.recipeName} numberOfLines={1}>
            👨‍🍳 {recipeName}
          </Text>

          {/* Adım sayacı */}
          <View style={styles.stepCounter}>
            <Text style={styles.stepCounterText}>
              {currentIndex + 1}/{steps.length}
            </Text>
          </View>
        </View>

        {/* ── Sesli Komut Durumu ───────────────────────────────── */}
        {isListening && (
          <View style={styles.voiceBadge}>
            <View style={styles.voiceDot} />
            <Text style={styles.voiceBadgeText}>
              🎤 Sesli Komut Aktif {lastCommand ? `— ${lastCommand}` : '— "geç" veya "geri" deyin'}
            </Text>
          </View>
        )}

        {/* ── İlerleme Çubuğu ────────────────────────────────── */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress * 100}%` }]} />
          </View>
          {/* Nokta göstergeleri */}
          <View style={styles.dotsRow}>
            {steps.map((_, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.dot, i === currentIndex && styles.dotActive]}
                onPress={() =>
                  flatListRef.current?.scrollToIndex({ index: i, animated: true })
                }
              />
            ))}
          </View>
        </View>

        {/* ── Adım Kartları (Yatay Kaydırma) ─────────────────── */}
        <FlatList
          style={{ flex: 1 }}
          ref={flatListRef}
          data={steps}
          keyExtractor={(_, i) => String(i)}
          renderItem={({ item, index }) => (
            <StepCard
              step={item}
              stepNumber={index + 1}
              totalSteps={steps.length}
            />
          )}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onViewableItemsChanged={onViewableItemsChanged}
          viewabilityConfig={viewabilityConfig}
          scrollEventThrottle={16}
          bounces={false}
          decelerationRate="fast"
        />

        {/* ── Alt Navigasyon Butonları ────────────────────────── */}
        <View style={styles.navRow}>
          {/* Önceki */}
          <View style={{ flex: 1, alignItems: 'flex-start' }}>
            <TouchableOpacity
              style={[styles.navButton, isFirst && styles.navButtonDisabled]}
              onPress={goToPrev}
              disabled={isFirst}
              activeOpacity={0.7}
            >
              <Ionicons
                name="chevron-back"
                size={24}
                color={isFirst ? COOKING_COLORS.textMuted : COOKING_COLORS.textPrimary}
              />
              <Text style={[styles.navButtonText, isFirst && styles.navButtonTextDisabled]}>
                Önceki
              </Text>
            </TouchableOpacity>
          </View>

          {/* Mikrofon Butonu */}
          <View style={{ flex: 1, alignItems: 'center' }}>
            <TouchableOpacity
              style={[styles.micButton, isListening && styles.micButtonActive]}
              onPress={toggleListening}
              activeOpacity={0.7}
            >
              <Ionicons
                name={isListening ? 'mic' : 'mic-outline'}
                size={28}
                color={isListening ? '#FFFFFF' : COOKING_COLORS.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* Sonraki veya Bitir Butonu */}
          <View style={{ flex: 1, alignItems: 'flex-end' }}>
            {isLast ? (
              <TouchableOpacity style={styles.finishButton} onPress={onClose}>
                <LinearGradient
                  colors={[COOKING_COLORS.accent, COOKING_COLORS.accentLight]}
                  style={styles.finishButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Ionicons name="checkmark-circle" size={20} color="white" />
                  <Text style={styles.finishButtonText}>Bitir</Text>
                </LinearGradient>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                style={styles.navButton}
                onPress={goToNext}
                activeOpacity={0.7}
              >
                <Text style={styles.navButtonText}>Sonraki</Text>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={COOKING_COLORS.textPrimary}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* ── Alt Güvenli Alan ────────────────────────────────── */}
        <View style={styles.safeBottom} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COOKING_COLORS.bg,
  },
  // ── Üst Bar ─────────────────────────────────────────────────
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 56 : 44,
    paddingBottom: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COOKING_COLORS.navButton,
    borderWidth: 1,
    borderColor: COOKING_COLORS.navButtonBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recipeName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COOKING_COLORS.textPrimary,
    textAlign: 'center',
    marginHorizontal: 12,
  },
  stepCounter: {
    backgroundColor: COOKING_COLORS.navButton,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COOKING_COLORS.navButtonBorder,
  },
  stepCounterText: {
    fontSize: 14,
    fontWeight: '700',
    color: COOKING_COLORS.accent,
  },
  // ── Sesli Komut Badge ──────────────────────────────────────
  voiceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(76, 175, 80, 0.15)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.3)',
  },
  voiceDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COOKING_COLORS.micActive,
  },
  voiceBadgeText: {
    fontSize: 13,
    color: COOKING_COLORS.micActive,
    fontWeight: '600',
  },
  // ── İlerleme ────────────────────────────────────────────────
  progressContainer: {
    paddingHorizontal: 20,
    gap: 10,
  },
  progressBarBg: {
    height: 4,
    backgroundColor: COOKING_COLORS.progressBg,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: COOKING_COLORS.progressFill,
    borderRadius: 2,
  },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COOKING_COLORS.progressBg,
  },
  dotActive: {
    width: 20,
    backgroundColor: COOKING_COLORS.accent,
  },
  // ── Alt Navigasyon ──────────────────────────────────────────
  navRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.06)',
  },
  navButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COOKING_COLORS.navButton,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: COOKING_COLORS.navButtonBorder,
  },
  navButtonDisabled: {
    opacity: 0.3,
  },
  navButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: COOKING_COLORS.textPrimary,
  },
  navButtonTextDisabled: {
    color: COOKING_COLORS.textMuted,
  },
  micButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COOKING_COLORS.navButton,
    borderWidth: 1,
    borderColor: COOKING_COLORS.navButtonBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  micButtonActive: {
    backgroundColor: COOKING_COLORS.micActive,
    borderColor: COOKING_COLORS.micActive,
  },
  finishButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  finishButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  finishButtonText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  safeBottom: {
    height: Platform.OS === 'ios' ? 28 : 12,
  },
});
