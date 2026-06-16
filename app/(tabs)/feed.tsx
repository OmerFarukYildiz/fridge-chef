import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Image, RefreshControl, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getFeedPosts, toggleLikePost, deleteFeedPost } from '../../services/firestoreService';
import { FeedPost } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { AppThemeColors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { useFocusEffect, useRouter } from 'expo-router';
import ScreenBackground from '../../components/ScreenBackground';

export default function FeedScreen() {
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const router = useRouter();

  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadFeed = async () => {
    try {
      const data = await getFeedPosts();
      setPosts(data);
    } catch (err) {
      console.error('[Feed]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [])
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadFeed();
  };

  const handleLike = async (postId: string) => {
    if (!user) return;
    // Optimistic UI
    setPosts(prev => prev.map(p => {
      if (p.id === postId) {
        const isLiked = p.likedBy.includes(user.uid);
        return {
          ...p,
          likes: isLiked ? p.likes - 1 : p.likes + 1,
          likedBy: isLiked ? p.likedBy.filter(id => id !== user.uid) : [...p.likedBy, user.uid]
        };
      }
      return p;
    }));
    await toggleLikePost(postId, user.uid);
  };

  const handleDeletePost = (postId: string) => {
    Alert.alert('Sil', 'Bu gönderiyi silmek istediğine emin misin?', [
      { text: 'İptal', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: async () => {
        await deleteFeedPost(postId);
        setPosts(prev => prev.filter(p => p.id !== postId));
      }}
    ]);
  };

  const renderPost = ({ item }: { item: FeedPost }) => {
    const isLiked = user ? item.likedBy.includes(user.uid) : false;
    const timeStr = new Date(item.createdAt).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });

    return (
      <View style={styles.postCard}>
        <View style={styles.postHeader}>
          <View style={styles.userInfo}>
            {item.userPhoto ? (
              <Image source={{ uri: item.userPhoto }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{item.userName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View>
              <Text style={styles.userName}>{item.userName}</Text>
              <Text style={styles.timeText}>{timeStr}</Text>
            </View>
          </View>
        </View>

        <View style={styles.recipeContent}>
          <Text style={styles.recipeTitle}>{item.recipe.tarifAdi}</Text>
          <Text style={styles.recipeDesc} numberOfLines={2}>{item.recipe.ipuclari || 'Harika bir tarif daha!'}</Text>
          
          <View style={styles.recipeTags}>
            <View style={styles.tag}><Text style={styles.tagText}>⏱️ {item.recipe.hazirlikSuresi}</Text></View>
            <View style={styles.tag}><Text style={styles.tagText}>🔥 {item.recipe.kaloriTahmini}</Text></View>
          </View>
        </View>

        <View style={styles.postActions}>
          <TouchableOpacity style={styles.actionBtn} onPress={() => handleLike(item.id)}>
            <Ionicons name={isLiked ? "heart" : "heart-outline"} size={24} color={isLiked ? colors.error : colors.textMuted} />
            <Text style={[styles.actionText, isLiked && styles.actionTextLiked]}>{item.likes}</Text>
          </TouchableOpacity>
          {user && item.userId === user.uid && (
            <TouchableOpacity style={styles.deleteBtn} onPress={() => handleDeletePost(item.id)}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScreenBackground style={styles.root}>
      <LinearGradient
        colors={[colors.primary, colors.primaryDark]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <Text style={styles.headerTitle}>🌍 Sosyal Akış</Text>
        <Text style={styles.headerSubtitle}>Başkalarının pişirdiği harika tarifleri keşfet</Text>
      </LinearGradient>

      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderPost}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="planet-outline" size={64} color={colors.border} />
            <Text style={styles.emptyText}>Henüz kimse bir şey paylaşmamış.</Text>
            <Text style={styles.emptySub}>İlk paylaşan sen ol!</Text>
          </View>
        }
      />
    </ScreenBackground>
  );
}

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  root: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24, borderBottomRightRadius: 24,
  },
  headerTitle: { fontSize: Typography['2xl'], fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.85)', marginTop: 4 },
  listContent: { padding: Spacing.base, paddingBottom: 100 },
  
  postCard: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  userInfo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarPlaceholder: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center' },
  avatarInitial: { color: 'white', fontWeight: 'bold', fontSize: 18 },
  userName: { fontSize: Typography.base, fontWeight: '700', color: colors.textPrimary },
  timeText: { fontSize: Typography.xs, color: colors.textMuted },
  
  recipeContent: {
    backgroundColor: colors.background,
    padding: Spacing.md,
    borderRadius: Radius.md,
    marginBottom: 12,
  },
  recipeTitle: { fontSize: Typography.lg, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  recipeDesc: { fontSize: Typography.sm, color: colors.textSecondary, marginBottom: 8 },
  recipeTags: { flexDirection: 'row', gap: 8 },
  tag: { backgroundColor: colors.surface, paddingHorizontal: 8, paddingVertical: 4, borderRadius: Radius.sm },
  tagText: { fontSize: Typography.xs, color: colors.textPrimary },
  
  postActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontSize: Typography.base, color: colors.textMuted, fontWeight: '600' },
  actionTextLiked: { color: colors.error },
  deleteBtn: { padding: 4 },
  
  emptyContainer: { alignItems: 'center', marginTop: 100 },
  emptyText: { fontSize: Typography.lg, fontWeight: '600', color: colors.textSecondary, marginTop: 16 },
  emptySub: { fontSize: Typography.sm, color: colors.textMuted, marginTop: 4 },
});
