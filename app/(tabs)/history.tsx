// ============================================================
// Fridge Chef — Tarif Geçmişi Ekranı
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
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { getHistory, deleteFromHistory, clearHistory } from '../../services/firestoreService';
import { HistoryRecipe } from '../../types';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// ── Tarif Kartı Bileşeni ─────────────────────────────────────
interface HistoryCardProps {
  item: HistoryRecipe;
  onDelete: (id: string, name: string) => void;
  onPress: (item: HistoryRecipe) => void;
}

function HistoryCard({ item, onDelete, onPress }: HistoryCardProps) {
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
            <Ionicons name="trash-outline" size={18} color={Colors.error} />
          </TouchableOpacity>
        </View>

        {/* Rozetler */}
        <View style={styles.cardBadges}>
          <View style={styles.badge}>
            <Ionicons name="time-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.badgeText}>{item.hazirlikSuresi}</Text>
          </View>
          <View style={styles.badge}>
            <Ionicons name="flame-outline" size={13} color={Colors.textMuted} />
            <Text style={styles.badgeText}>{item.kaloriTahmini}</Text>
          </View>
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
function EmptyHistory() {
  const router = useRouter();
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="time-outline" size={56} color={Colors.primary} />
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
        <Ionicons name="camera-outline" size={18} color={Colors.white} />
        <Text style={styles.emptyButtonText}>İlk Tarifinizi Oluşturun</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────
export default function HistoryScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [history, setHistory] = useState<HistoryRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

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
      params: {
        fromHistory: 'true',
        recipeJson: JSON.stringify(item),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="time" size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Geçmiş yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>📜 Tarif Geçmişi</Text>
            <Text style={styles.headerSubtitle}>
              {history.length} tarif (maks. 20)
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

      <FlatList
        data={history}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HistoryCard
            item={item}
            onDelete={handleDelete}
            onPress={handleCardPress}
          />
        )}
        ListEmptyComponent={<EmptyHistory />}
        contentContainerStyle={[
          styles.listContent,
          history.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadHistory();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  // ── Header ─────────────────────────────────────────────────
  header: {
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography['2xl'],
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  clearButtonText: {
    fontSize: Typography.xs,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardAccent: {
    width: 5,
    backgroundColor: Colors.info,
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
    color: Colors.textPrimary,
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
    color: Colors.textMuted,
    fontWeight: '500',
  },
  ingredientPreview: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
  },
  viewedDate: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  // ── Yükleniyor ─────────────────────────────────────────────
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: 16,
  },
  loadingText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
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
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: Radius.xl,
    marginTop: 8,
    ...Shadow.md,
  },
  emptyButtonText: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: '700',
  },
});
