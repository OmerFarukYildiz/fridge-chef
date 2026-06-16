// ============================================================
// Fridge Chef — Tarif Geçmişi Ekranı
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Alert, RefreshControl, ScrollView, ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getHistory, deleteFromHistory, clearHistory } from '../../services/firestoreService';
import { HistoryRecipe } from '../../types';
import { AppThemeColors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

// ── Filtre Seçenekleri ───────────────────────────────────────────
const CATEGORY_FILTERS = ['Tümü', 'Kahvaltı', 'Öğle', 'Akşam', 'Atıştırmalık', 'Tatlı', 'Çorba', 'Salata'];
const DIFFICULTY_FILTERS = ['Tümü', 'Kolay', 'Orta', 'Zor'];
const TIME_FILTERS = [
  { label: 'Tümü', max: Infinity },
  { label: '⚡ <15dk', max: 15 },
  { label: '🕒 15-30dk', max: 30, min: 15 },
  { label: '🍳 30dk+', min: 30, max: Infinity },
];
const parseMinutes = (t: string) => { const m = t.match(/(\d+)/); return m ? parseInt(m[1], 10) : 999; };

function FilterChip({ label, active, onPress, colors }: { label: string; active: boolean; onPress: () => void, colors: AppThemeColors }) {
  const { isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  return (
    <TouchableOpacity style={[styles.chip, active && styles.chipActive]} onPress={onPress} activeOpacity={0.75}>
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

// ── Tarif Kartı Bileşeni ─────────────────────────────────────
interface HistoryCardProps {
  item: HistoryRecipe;
  onDelete: (id: string, name: string) => void;
  onPress: (item: HistoryRecipe) => void;
  colors: AppThemeColors;
}

function HistoryCard({ item, onDelete, onPress, colors }: HistoryCardProps) {
  const { isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  const viewedDate = new Date(item.viewedAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => onPress(item)}
      activeOpacity={0.85}
    >
      {/* Sol renkli şerit */}
      <View style={styles.cardAccent} />

      <View style={styles.cardContent}>
        {/* Üst kısım */}
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.tarifAdi}
          </Text>
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(item.id, item.tarifAdi)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="trash-outline" size={18} color={colors.error} />
          </TouchableOpacity>
        </View>

        {/* Kategori + Zorluk Badge'leri */}
        <View style={styles.cardBadges}>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={styles.badgeText}>{item.hazirlikSuresi}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="flame-outline" size={13} color={colors.textMuted} />
            <Text style={styles.badgeText}>{item.kaloriTahmini}</Text>
          </View>
          {item.zorlukSeviyesi && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>📊 {item.zorlukSeviyesi}</Text>
            </View>
          )}
          {item.kategori && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>🍽️ {item.kategori}</Text>
            </View>
          )}
        </View>

        {/* Malzeme özeti */}
        <Text style={styles.ingredientPreview} numberOfLines={1}>
          🥗 {item.kullanilanMalzemeler.slice(0, 3).join(', ')}
          {item.kullanilanMalzemeler.length > 3 ? '...' : ''}
        </Text>

        {/* Görüntülenme Tarihi */}
        <Text style={styles.viewedDate}>🕐 {viewedDate}</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Boş Durum ────────────────────────────────────────────────
function EmptyHistory({ colors }: { colors: AppThemeColors }) {
  const router = useRouter();
  const { isDark } = useTheme();
  const styles = getStyles(colors, isDark);
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="time-outline" size={56} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Henüz tarif geçmişiniz yok</Text>
      <Text style={styles.emptySubtitle}>
        Fotoğraf çekip tarif oluşturduğunuzda otomatik olarak burada listelenecektir
      </Text>
      <TouchableOpacity
        style={styles.emptyButton}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onPress={() => router.push('/(tabs)' as any)}
      >
        <Ionicons name="camera-outline" size={18} color={colors.white} />
        <Text style={styles.emptyButtonText}>İlk Tarifinizi Oluşturun</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────
export default function HistoryScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();
  const [history, setHistory] = useState<HistoryRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // Filtre state'leri
  const [categoryFilter, setCategoryFilter] = useState('Tümü');
  const [difficultyFilter, setDifficultyFilter] = useState('Tümü');
  const [timeFilterIdx, setTimeFilterIdx] = useState(0);

  // Sekmeye her odaklanıldığında yenile
  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [user])
  );

  const loadHistory = async () => {
    if (!user) return;
    try {
      const data = await getHistory(user.uid);
      setHistory(data);
    } catch (err) {
      console.error('[History]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Geçmişten Kaldır',
      `"${name}" tarifini geçmişten kaldırmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await deleteFromHistory(user.uid, id);
            setHistory((prev) => prev.filter((h) => h.id !== id));
          },
        },
      ]
    );
  };

  const handleClearAll = () => {
    if (history.length === 0) return;
    Alert.alert(
      'Tüm Geçmişi Temizle',
      'Tüm tarif geçmişiniz silinecektir. Emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await clearHistory(user.uid);
            setHistory([]);
          },
        },
      ]
    );
  };

  const handleCardPress = (item: HistoryRecipe) => {
    router.push({
      pathname: '/recipe',
      params: { fromHistory: 'true', recipeJson: JSON.stringify(item) },
    });
  };

  // Filtreleme
  const timeFilter = TIME_FILTERS[timeFilterIdx];
  const filtered = history.filter((h) => {
    if (categoryFilter !== 'Tümü' && h.kategori !== categoryFilter) return false;
    if (difficultyFilter !== 'Tümü' && h.zorlukSeviyesi !== difficultyFilter) return false;
    const minutes = parseMinutes(h.hazirlikSuresi);
    if (timeFilter.min !== undefined && minutes < timeFilter.min) return false;
    if (timeFilter.max !== Infinity && minutes > timeFilter.max) return false;
    return true;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>Geçmiş yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={['#8B5CF6', '#7C3AED']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>📜 Tarif Geçmişi</Text>
            <Text style={styles.headerSubtitle}>
              {filtered.length} / {history.length} tarif (maks. 20)
            </Text>
          </View>
          {history.length > 0 && (
            <TouchableOpacity style={styles.clearButton} onPress={handleClearAll}>
              <Ionicons name="trash-outline" size={16} color="rgba(255,255,255,0.9)" />
              <Text style={styles.clearButtonText}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>

      {/* Filtre Çipleri */}
      <View style={styles.filtersSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {CATEGORY_FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={categoryFilter === f} onPress={() => setCategoryFilter(f)} colors={colors} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          {DIFFICULTY_FILTERS.map((f) => (
            <FilterChip key={f} label={f} active={difficultyFilter === f} onPress={() => setDifficultyFilter(f)} colors={colors} />
          ))}
          {TIME_FILTERS.map((f, i) => (
            <FilterChip key={f.label} label={f.label} active={timeFilterIdx === i} onPress={() => setTimeFilterIdx(i)} colors={colors} />
          ))}
        </ScrollView>
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryCard item={item} onDelete={handleDelete} onPress={handleCardPress} colors={colors} />
        )}
        ListEmptyComponent={<EmptyHistory colors={colors} />}
        contentContainerStyle={[
          styles.listContent,
          filtered.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHistory();
            }}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  // ── Header ─────────────────────────────────────────────
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '800', color: colors.white },
  headerSubtitle: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  clearButton: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)', paddingVertical: 8, paddingHorizontal: 14, borderRadius: Radius.full,
  },
  clearButtonText: { fontSize: Typography.xs, fontWeight: '600', color: 'rgba(255,255,255,0.9)' },
  // ── Filtreler ────────────────────────────────────────────
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
  listContent: {
    padding: Spacing.base,
    gap: 12,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  // ── Kart ───────────────────────────────────────────────────
  card: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardAccent: {
    width: 5,
    backgroundColor: colors.info,
  },
  cardContent: {
    flex: 1,
    padding: Spacing.base,
    gap: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: Typography.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    lineHeight: 24,
  },
  deleteButton: {
    padding: 4,
  },
  cardBadges: {
    flexDirection: 'row',
    gap: 10,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  badgeText: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    fontWeight: '500',
  },
  ingredientPreview: {
    fontSize: Typography.sm,
    color: colors.textSecondary,
  },
  viewedDate: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    marginTop: 2,
  },
  // ── Yükleniyor ─────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: Typography.base,
    color: colors.textSecondary,
  },
  // ── Boş Durum ──────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
    gap: 16,
  },
  emptyIconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: Typography.xl,
    fontWeight: '700',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Radius.xl,
    marginTop: 8,
    ...Shadow.md,
  },
  emptyButtonText: {
    color: colors.white,
    fontSize: Typography.base,
    fontWeight: '700',
  },
});
