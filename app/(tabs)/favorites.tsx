// ============================================================
// Fridge Chef — Favoriler Ekranı
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
import { getFavorites, removeFromFavorites } from '../../services/firestoreService';
import { FavoriteRecipe } from '../../types';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// ── Tarif Kartı Bileşeni ─────────────────────────────────────
interface RecipeCardProps {
  item: FavoriteRecipe;
  onDelete: (id: string, name: string) => void;
  onPress: (item: FavoriteRecipe) => void;
}

function FavoriteCard({ item, onDelete, onPress }: RecipeCardProps) {
  const savedDate = new Date(item.savedAt).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
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

        {/* Kayıt Tarihi */}
        <Text style={styles.savedDate}>❤️ {savedDate} tarihinde kaydedildi</Text>
      </View>
    </TouchableOpacity>
  );
}

// ── Boş Durum ────────────────────────────────────────────────
function EmptyFavorites() {
  const router = useRouter();
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="heart-outline" size={56} color={Colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>Henüz favori tarifiniz yok</Text>
      <Text style={styles.emptySubtitle}>
        Tarif oluşturup ❤️ butonuna basarak favorilere ekleyebilirsiniz
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
export default function FavoritesScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [favorites, setFavorites] = useState<FavoriteRecipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Sekmeye her odaklanıldığında yenile
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
    } catch (err) {
      console.error('[Favorites]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Favoriden Kaldır',
      `"${name}" tarifini favorilerinizden kaldırmak istiyor musunuz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await removeFromFavorites(user.uid, id);
            setFavorites((prev) => prev.filter((f) => f.id !== id));
          },
        },
      ]
    );
  };

  const handleCardPress = (item: FavoriteRecipe) => {
    // Tarif detayını parametre olarak geç
    router.push({
      pathname: '/recipe',
      params: {
        fromFavorite: 'true',
        recipeJson: JSON.stringify(item),
      },
    });
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="heart" size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Favoriler yükleniyor...</Text>
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
        <Text style={styles.headerTitle}>❤️ Favori Tariflerim</Text>
        <Text style={styles.headerSubtitle}>
          {favorites.length} tarif kaydedildi
        </Text>
      </LinearGradient>

      <FlatList
        data={favorites}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FavoriteCard
            item={item}
            onDelete={handleDelete}
            onPress={handleCardPress}
          />
        )}
        ListEmptyComponent={<EmptyFavorites />}
        contentContainerStyle={[
          styles.listContent,
          favorites.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadFavorites();
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
    backgroundColor: Colors.primary,
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
  savedDate: {
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
