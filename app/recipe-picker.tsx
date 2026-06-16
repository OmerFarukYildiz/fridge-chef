// ============================================================
// Fridge Chef — 10 Tarif Seçeneği Ekranı
// ============================================================
// Akış: Kamera → recipe-picker (bu ekran) → recipe (detay)
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { getRecipeOptionsFromImage, getFullRecipeBySelection } from '../services/geminiService';
import { NonFoodImageError, RecipeOption } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppThemeColors, Typography, Spacing, Radius, Shadow } from '../constants/Colors';
import { getHistory } from '../services/firestoreService';

// ── Zorluk Rozet Renkleri ────────────────────────────────────
const DIFFICULTY_COLORS: Record<string, { bg: string; text: string }> = {
  Kolay: { bg: '#D1FAE5', text: '#065F46' },
  Orta: { bg: '#FEF3C7', text: '#92400E' },
  Zor:  { bg: '#FEE2E2', text: '#991B1B' },
};

// ── Kategori Emojileri ───────────────────────────────────────
const CATEGORY_EMOJI: Record<string, string> = {
  Kahvaltı: '🌅', Öğle: '☀️', Akşam: '🌙',
  Atıştırmalık: '🍿', Tatlı: '🍰', Çorba: '🍲',
  Salata: '🥗', Diğer: '🍽️',
};

// ── Tekli Tarif Kartı ─────────────────────────────────────────
interface OptionCardProps {
  item: RecipeOption;
  index: number;
  onSelect: (item: RecipeOption) => void;
  isLoading: boolean;
  styles: any;
  colors: AppThemeColors;
}

function OptionCard({ item, index, onSelect, isLoading, styles, colors }: OptionCardProps) {
  const diff = DIFFICULTY_COLORS[item.zorlukSeviyesi] ?? DIFFICULTY_COLORS.Orta;
  const emoji = CATEGORY_EMOJI[item.kategori] ?? '🍽️';

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onSelect(item)}
      activeOpacity={0.82}
      disabled={isLoading}
    >
      {/* Numara */}
      <View style={styles.cardNumber}>
        <Text style={styles.cardNumberText}>{index + 1}</Text>
      </View>

      {/* Kategori emoji */}
      <Text style={styles.cardEmoji}>{emoji}</Text>

      {/* Tarif Adı */}
      <Text style={styles.cardTitle} numberOfLines={2}>{item.tarifAdi}</Text>

      {/* Süre + Kalori */}
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="time-outline" size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>{item.hazirlikSuresi}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="flame-outline" size={12} color={colors.textMuted} />
          <Text style={styles.metaText}>{item.kaloriTahmini}</Text>
        </View>
      </View>

      {/* Zorluk + Mutfak */}
      <View style={styles.cardFooter}>
        <View style={[styles.diffBadge, { backgroundColor: diff.bg }]}>
          <Text style={[styles.diffText, { color: diff.text }]}>{item.zorlukSeviyesi}</Text>
        </View>
        <Text style={styles.cuisineText} numberOfLines={1}>{item.mutfakTuru}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────
export default function RecipePickerScreen() {
  const { base64Image, optionsJson, identifiedItems } = useLocalSearchParams<{ base64Image?: string; optionsJson?: string; identifiedItems?: string }>();
  const { user, userProfile } = useAuth();
  const { isDark, colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();

  const [options, setOptions] = useState<RecipeOption[]>(
    optionsJson ? JSON.parse(optionsJson) : []
  );
  const [loadingOptions, setLoadingOptions] = useState(!optionsJson);
  const [selectedOption, setSelectedOption] = useState<RecipeOption | null>(null);
  const [generatingRecipe, setGeneratingRecipe] = useState(false);
  const [error, setError] = useState<{ message: string; isNonFood: boolean } | null>(null);
  const [excludeList, setExcludeList] = useState<string[]>([]);

  useEffect(() => {
    loadExcludeList();
  }, []);

  useEffect(() => {
    if (excludeList !== undefined && !optionsJson) {
      fetchOptions();
    }
  }, [excludeList, optionsJson]);

  // Son 5 tarifi geçmişten çekip "bunları önerme" listesine ekle
  const loadExcludeList = async () => {
    if (!user) {
      setExcludeList([]);
      return;
    }
    try {
      const history = await getHistory(user.uid);
      setExcludeList(history.slice(0, 5).map((h) => h.tarifAdi));
    } catch {
      setExcludeList([]);
    }
  };

  const fetchOptions = async (retrying = false) => {
    if (!base64Image) {
      setError({ message: 'Görsel bulunamadı.', isNonFood: false });
      setLoadingOptions(false);
      return;
    }
    if (!retrying) setLoadingOptions(true);
    setError(null);
    try {
      const result = await getRecipeOptionsFromImage(
        base64Image,
        userProfile ?? undefined,
        excludeList
      );
      setOptions(result);
    } catch (err) {
      if (err instanceof NonFoodImageError) {
        setError({
          message: 'Lütfen sadece gıda malzemesi, buzdolabı veya yemek fotoğrafı yükleyin.',
          isNonFood: true,
        });
      } else {
        setError({
          message: 'Tarif seçenekleri yüklenemedi. Lütfen tekrar deneyin.',
          isNonFood: false,
        });
      }
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleSelect = async (option: RecipeOption) => {
    if (generatingRecipe) return;
    setSelectedOption(option);
    setGeneratingRecipe(true);
    try {
      const recipe = await getFullRecipeBySelection(
        option,
        base64Image,
        identifiedItems,
        userProfile ?? undefined
      );
      router.replace({
        pathname: '/recipe' as any,
        params: {
          recipeJson: JSON.stringify(recipe),
          fromPicker: 'true',
          base64Image,
        },
      });
    } catch (err: any) {
      console.error('[RecipePicker] handleSelect error:', err);
      Alert.alert('Hata', `Tarif oluşturulamadı: ${err?.message || err}`);
      setSelectedOption(null);
    } finally {
      setGeneratingRecipe(false);
    }
  };

  const handleRefresh = () => {
    setOptions([]);
    fetchOptions(true);
    setLoadingOptions(true);
  };

  // ── Yükleniyor ──────────────────────────────────────────────
  if (loadingOptions) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>Malzemeler inceleniyor... 🔍</Text>
        <Text style={styles.loadingSubtitle}>10 farklı tarif seçeneği hazırlanıyor</Text>
      </View>
    );
  }

  // ── Hata ───────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.errorIcon, error.isNonFood && styles.errorIconWarn]}>
          <Ionicons
            name={error.isNonFood ? 'fast-food-outline' : 'alert-circle-outline'}
            size={52}
            color={error.isNonFood ? colors.warning : colors.error}
          />
        </View>
        <Text style={styles.errorTitle}>
          {error.isNonFood ? 'Gıda Görseli Gerekli' : 'Bir Sorun Oluştu'}
        </Text>
        <Text style={styles.errorMsg}>{error.message}</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={18} color="white" />
          <Text style={styles.backBtnText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Detaylı Tarif Yükleniyor ──────────────────────────────
  if (generatingRecipe && selectedOption) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingTitle}>"{selectedOption.tarifAdi}" hazırlanıyor 👨‍🍳</Text>
        <Text style={styles.loadingSubtitle}>Detaylı tarif oluşturuluyor...</Text>
      </View>
    );
  }

  // ── Seçim Ekranı ──────────────────────────────────────────
  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={[colors.gradientStart, colors.gradientEnd]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.headerBack} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="white" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Tarif Seç 🍽️</Text>
          <Text style={styles.headerSub}>Hangisini yapmak istersin?</Text>
        </View>
        <TouchableOpacity style={styles.refreshBtn} onPress={handleRefresh}>
          <Ionicons name="refresh" size={20} color="white" />
        </TouchableOpacity>
      </LinearGradient>

      {/* 2'li Grid */}
      <FlatList
        data={options}
        keyExtractor={(_, i) => String(i)}
        numColumns={2}
        columnWrapperStyle={styles.row}
        contentContainerStyle={styles.listContent}
        renderItem={({ item, index }) => (
          <OptionCard
            item={item}
            index={index}
            onSelect={handleSelect}
            isLoading={generatingRecipe}
            styles={styles}
            colors={colors}
          />
        )}
        ListFooterComponent={
          <TouchableOpacity style={styles.refreshFooterBtn} onPress={handleRefresh}>
            <Ionicons name="refresh-outline" size={18} color={colors.primary} />
            <Text style={styles.refreshFooterText}>Bunları beğenmedim, yenile 🔄</Text>
          </TouchableOpacity>
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const CARD_WIDTH = '48%';

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16, backgroundColor: colors.background },
  // ── Header ────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 56,
    paddingBottom: 20,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 12,
  },
  headerBack: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '800', color: '#fff' },
  headerSub: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center', alignItems: 'center',
  },
  // ── Liste ────────────────────────────────────────────────
  listContent: { padding: Spacing.base, paddingBottom: 32, gap: 10 },
  row: { gap: 10 },
  // ── Kart ─────────────────────────────────────────────────
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: 14,
    gap: 8,
    ...Shadow.sm,
    position: 'relative',
  },
  cardNumber: {
    position: 'absolute',
    top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  cardNumberText: { fontSize: 11, fontWeight: '800', color: '#fff' },
  cardEmoji: { fontSize: 28 },
  cardTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 20,
    minHeight: 40,
  },
  cardMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  metaText: { fontSize: 11, color: colors.textMuted, fontWeight: '500' },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4 },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: Radius.full },
  diffText: { fontSize: 10, fontWeight: '700' },
  cuisineText: { fontSize: 10, color: colors.textMuted, flex: 1, textAlign: 'right' },
  // ── Loading / Error ──────────────────────────────────────
  loadingTitle: { fontSize: Typography.xl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  loadingSubtitle: { fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center' },
  errorIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center' },
  errorIconWarn: { backgroundColor: '#FEF3C7' },
  errorTitle: { fontSize: Typography.xl, fontWeight: '700', color: colors.textPrimary },
  errorMsg: { fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22, maxWidth: 280 },
  backBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 12, paddingHorizontal: 24,
    borderRadius: Radius.xl, ...Shadow.md,
  },
  backBtnText: { color: '#fff', fontWeight: '700', fontSize: Typography.base },
  // ── Yenile Footer ────────────────────────────────────────
  refreshFooterBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, marginTop: 8, paddingVertical: 14,
    borderRadius: Radius.lg, borderWidth: 1.5, borderColor: colors.primary,
    backgroundColor: colors.surface,
  },
  refreshFooterText: { fontSize: Typography.sm, color: colors.primary, fontWeight: '600' },
});
