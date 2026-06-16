// ============================================================
// Fridge Chef — Favoriler Ekranı (Filtreli + Puanlı)
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../context/AuthContext';
import { getFavorites, removeFromFavorites } from '../../services/firestoreService';
import { FavoriteRecipe } from '../../types';
import { AppThemeColors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

const FAVORITES_CACHE_KEY = (uid: string) => `@fridge_chef_favorites_${uid}`;

// ── Filtre Seçenekleri ────────────────────────────────────────
const CATEGORY_FILTERS = ['Tümü', 'Kahvaltı', 'Öğle', 'Akşam', 'Atıştırmalık', 'Tatlı', 'Çorba', 'Salata'];
const DIFFICULTY_FILTERS = ['Tümü', 'Kolay', 'Orta', 'Zor'];
const TIME_FILTERS = [
  { label: 'Tümü', max: Infinity },
  { label: '⚡ <15dk', max: 15 },
  { label: '🕒 15-30dk', max: 30, min: 15 },
  { label: '🍳 30dk+', min: 30, max: Infinity },
];

const parseMinutes = (timeStr: string): number => {
  const match = timeStr.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 999;
};

// ── Yıldız Gösterimi ─────────────────────────────────────────
function StarRow({ rating, styles, colors }: { rating?: number; styles: any; colors: AppThemeColors }) {
  if (!rating) return null;
  return (
    <View style={styles.starRow}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Ionicons
          key={s}
          name={s <= rating ? 'star' : 'star-outline'}
          size={14}
          color={s <= rating ? '#F59E0B' : colors.border}
        />
      ))}
    </View>
  );
}

// ── Favori Kart ───────────────────────────────────────────────
interface FavoriteCardProps {
  recipe: FavoriteRecipe;
  onPress: (r: FavoriteRecipe) => void;
  onDelete: (r: FavoriteRecipe) => void;
  styles: any;
  colors: AppThemeColors;
}

function FavoriteRecipeCard({ recipe, onPress, onDelete, styles, colors }: FavoriteCardProps) {
  const savedDate = new Date(recipe.savedAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <TouchableOpacity style={styles.card} onPress={() => onPress(recipe)} activeOpacity={0.85}>
      <View style={styles.cardAccent} />
      <View style={styles.cardContent}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>{recipe.tarifAdi}</Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(recipe)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        <StarRow rating={recipe.rating} styles={styles} colors={colors} />

        <View style={styles.cardBadges}>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.badgeText}>{recipe.hazirlikSuresi}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="flame-outline" size={13} color={colors.textMuted} />
            <Text style={styles.badgeText}>{recipe.kaloriTahmini}</Text>
          </View>
          {recipe.zorlukSeviyesi && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📊 {recipe.zorlukSeviyesi}</Text>
            </View>
          )}
          {recipe.kategori && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🍽️ {recipe.kategori}</Text>
            </View>
          )}
        </View>

        {recipe.note ? (
          <Text style={styles.notePreview} numberOfLines={1}>📝 {recipe.note}</Text>
        ) : (
          <Text style={styles.ingredientPreview} numberOfLines={1}>
            🥗 {recipe.kullanilanMalzemeler.slice(0, 3).join(', ')}
            {recipe.kullanilanMalzemeler.length > 3 ? '...' : ''}
          </Text>
        )}

        <Text style={styles.savedDate}>❤️ {savedDate} tarihinde kaydedildi</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Filtre Chip ───────────────────────────────────────────────
function FilterChip({ label, active, onPress, colors, styles }: { label: string; active: boolean; onPress: () => void; colors: AppThemeColors; styles: any }) {
  return (
    <TouchableOpacity
      style={[styles.chip, active && { borderColor: colors.primary, backgroundColor: '#FFF4E6' }]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={[styles.chipText, active && { color: colors.primary, fontWeight: '700' }]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Boş Durum ─────────────────────────────────────────────────
function EmptyFavorites({ hasFilters, colors, styles }: { hasFilters: boolean; colors: AppThemeColors; styles: any }) {
  const router = useRouter();
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="heart-outline" size={56} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>
        {hasFilters ? 'Bu filtrelerle tarif bulunamadı' : 'Henüz favori tarifiniz yok'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasFilters
          ? 'Farklı filtreler deneyin'
          : 'Tarif oluşturup ❤️ butonuna basarak favorilere ekleyebilirsiniz'}
      </Text>
      {!hasFilters && (
        <TouchableOpacity
          style={[styles.emptyButton, { backgroundColor: colors.primary }]}
          onPress={() => router.push('/(tabs)' as any)}
        >
          <Ionicons name="camera-outline" size={18} color={colors.white} />
          <Text style={styles.emptyButtonText}>İlk Tarifinizi Oluşturun</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────
export default function FavoritesScreen() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);

  const [categoryFilter, setCategoryFilter] = useState('Tümü');
  const [difficultyFilter, setDifficultyFilter] = useState('Tümü');
  const [timeFilterIdx, setTimeFilterIdx] = useState(0);

  useFocusEffect(
    useCallback(() => {
      loadFavorites();
    }, [user])
  );

  const loadFavorites = async () => {
    if (!user) return;
    try {
      const data = await getFavorites(user.uid);
      setFavorites(data);
      setIsOffline(false);
      await AsyncStorage.setItem(FAVORITES_CACHE_KEY(user.uid), JSON.stringify(data));
    } catch (err) {
      console.error('[Favorites]', err);
      try {
        const cached = await AsyncStorage.getItem(FAVORITES_CACHE_KEY(user.uid));
        if (cached) {
          setFavorites(JSON.parse(cached));
          setIsOffline(true);
        }
      } catch { }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRemoveFavorite = (recipe: FavoriteRecipe) => {
    Alert.alert(
      'Favoriden Kaldır',
      `"${recipe.tarifAdi}" tarifini favorilerinizden kaldırmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır', style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await removeFromFavorites(user.uid, recipe.id);
            setFavorites((prev) => prev.filter((f) => f.id !== recipe.id));
          },
        },
      ]
    );
  };

  const handlePressRecipe = (item: FavoriteRecipe) => {
    router.push({
      pathname: '/recipe',
      params: { fromFavorite: 'true', recipeJson: JSON.stringify(item) },
    });
  };

  const timeFilter = TIME_FILTERS[timeFilterIdx];
  const filtered = favorites.filter((f) => {
    if (categoryFilter !== 'Tümü' && f.kategori !== categoryFilter) return false;
    if (difficultyFilter !== 'Tümü' && f.zorlukSeviyesi !== difficultyFilter) return false;
    const minutes = parseMinutes(f.hazirlikSuresi);
    if (timeFilter.min !== undefined && minutes < timeFilter.min) return false;
    if (timeFilter.max !== Infinity && minutes > timeFilter.max) return false;
    return true;
  });

  const hasFilters = categoryFilter !== 'Tümü' || difficultyFilter !== 'Tümü' || timeFilterIdx !== 0;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Favorileriniz yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#F43F5E', '#E11D48']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>🤍 Favori Tariflerim</Text>
        <Text style={styles.headerSubtitle}>
          {filtered.length} / {favorites.length} tarif
          {isOffline ? ' • 📵 Çevrimdışı' : ''}
        </Text>
      </LinearGradient>

      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {CATEGORY_FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={categoryFilter === f} onPress={() => setCategoryFilter(f)} colors={colors} styles={styles} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {DIFFICULTY_FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={difficultyFilter === f} onPress={() => setDifficultyFilter(f)} colors={colors} styles={styles} />
          ))}
          {TIME_FILTERS.map((f, i) => (
            <FilterChip key={f.label} label={f.label} active={timeFilterIdx === i} onPress={() => setTimeFilterIdx(i)} colors={colors} styles={styles} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FavoriteRecipeCard recipe={item} onPress={handlePressRecipe} onDelete={handleRemoveFavorite} styles={styles} colors={colors} />
        )}
        ListEmptyComponent={<EmptyFavorites hasFilters={hasFilters} colors={colors} styles={styles} />}
        contentContainerStyle={[styles.listContent, filtered.length === 0 && styles.listContentEmpty]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadFavorites(); }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const getStyles = (colors: AppThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // ── Header ────────────────────────────────────────────────
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  // ── Filtreler ─────────────────────────────────────────────
  filtersSection: { paddingTop: 12, gap: 4 },
  filterRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 4 },
  chip: {
    paddingVertical: 7, paddingHorizontal: 14, borderRadius: Radius.full,
    borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#FFF4E6' },
  chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '500' },
  chipTextActive: { color: colors.primary, fontWeight: '700' },
  // ── Liste ──────────────────────────────────────────────────
  listContent: { padding: Spacing.base, gap: 12, paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },
  // ── Kart ───────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface, borderRadius: Radius.lg,
    flexDirection: 'row', overflow: 'hidden', ...Shadow.sm,
  },
  cardAccent: { width: 5, backgroundColor: colors.primary },
  cardContent: { flex: 1, padding: Spacing.base, gap: 5 },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', gap: 8,
  },
  cardTitle: { flex: 1, fontSize: Typography.lg, fontWeight: '700', color: colors.textPrimary, lineHeight: 24 },
  deleteButton: { padding: 4 },
  starRow: { flexDirection: 'row', gap: 2 },
  cardBadges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  badgeText: { fontSize: Typography.xs, color: colors.textMuted, fontWeight: '500' },
  ingredientPreview: { fontSize: Typography.sm, color: colors.textSecondary },
  notePreview: { fontSize: Typography.sm, color: colors.info, fontStyle: 'italic' },
  savedDate: { fontSize: Typography.xs, color: colors.textMuted, marginTop: 2 },
  // ── Yükleniyor ─────────────────────────────────────────────
  loadingContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.background, gap: 16,
  },
  loadingText: { fontSize: Typography.base, color: colors.textSecondary },
  // ── Boş Durum ──────────────────────────────────────────────
  emptyContainer: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
    padding: Spacing['2xl'], gap: 16,
  },
  emptyIconCircle: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: '#FFF4E6', justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: Typography.xl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  emptySubtitle: { fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 22 },
  emptyButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: Radius.xl, marginTop: 8, ...Shadow.md,
  },
  emptyButtonText: { color: colors.white, fontSize: Typography.base, fontWeight: '700' },
});
