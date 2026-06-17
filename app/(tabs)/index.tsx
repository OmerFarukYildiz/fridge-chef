// ============================================================
// Fridge Chef — Ana Ekran (Home)
// ============================================================
// Merkezi "Dolabını Tara" CTA butonu ile temiz, iştah açıcı
// bir giriş sayfası. Kullanıcıya hoş geldin mesajı ve
// son tarif istatistikleri gösterilir.
// ============================================================

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Image,
  Alert,
  RefreshControl,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import ScreenBackground from '../../components/ScreenBackground';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { AppThemeColors, Typography, Spacing, Radius, Shadow } from '../../constants/Colors';
import { getFavorites, getShoppingList, getDailyCalories, getPantryItems } from '../../services/firestoreService';
import { getQuickSnackRecipes } from '../../services/geminiService';

// ── Mevsim Tespiti ─────────────────────────────────────────────────
const getSeasonalInfo = () => {
  const month = new Date().getMonth() + 1; // 1-12
  if (month >= 3 && month <= 5) return { label: 'Bahar Tarifleri', emoji: '🌸', colors: ['#FDE68A', '#FCA5A5'] as [string, string], query: 'taze bahar sebzeli hafif' };
  if (month >= 6 && month <= 8) return { label: 'Yaz Tarifleri', emoji: '☀️', colors: ['#FCD34D', '#FB923C'] as [string, string], query: 'serin serin yaz meyve sebze' };
  if (month >= 9 && month <= 11) return { label: 'Sonbahar Tarifleri', emoji: '🍂', colors: ['#D97706', '#92400E'] as [string, string], query: 'sıcak sıcacık sonbahar' };
  return { label: 'Kış Tarifleri', emoji: '❄️', colors: ['#60A5FA', '#3730A3'] as [string, string], query: 'ısıtıcı kış güveç çorba' };
};

// ── Hızlı İpucu Kartları ─────────────────────────────────────
const TIPS = [
  { icon: '📸', text: 'Buzdolabını açık fotoğrafla — tüm malzemeleri görsün' },
  { icon: '🌱', text: 'Diyet tercihlerini kayıt sırasında ayarladın' },
  { icon: '🛒', text: 'Eksik malzemeleri tek tıkla alışveriş listesine ekle' },
  { icon: '❤️', text: 'Beğendiğin tarifleri favorilere kaydet' },
];

export default function IndexScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [favoriteCount, setFavoriteCount] = useState(0);
  const [shoppingCount, setShoppingCount] = useState(0);
  const [todayCalories, setTodayCalories] = useState(0);
  const [snackLoading, setSnackLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const season = getSeasonalInfo();
  const calorieGoal = 2000; // Varsayılan

  // Pulse animasyonu (CTA butonu için)
  const pulseAnim = new Animated.Value(1);

  useEffect(() => {
    // Pulse animasyonu başlat
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.04,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadStats();
      }
    }, [user, userProfile?.familyId])
  );

  const loadStats = async () => {
    if (!user) return;
    try {
      const targetId = userProfile?.familyId || user.uid;
      const [favs, shopping, kcal] = await Promise.all([
        getFavorites(user.uid), // favorites are still personal
        getShoppingList(targetId), // shopping list is family wide
        getDailyCalories(user.uid), // calories are still personal
      ]);
      setFavoriteCount(favs.length);
      setShoppingCount(shopping.filter((i: any) => !i.checked).length);
      setTodayCalories(kcal);
    } catch {
      // Sessizce geç
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };

  const handleQuickSnack = async () => {
    if (!user) return;
    setSnackLoading(true);
    try {
      const targetId = userProfile?.familyId || user.uid;
      const pantry = await getPantryItems(targetId);
      const items = pantry.map(i => i.name);
      const options = await getQuickSnackRecipes(items, userProfile ?? undefined);
      router.push({
        pathname: '/recipe-picker',
        params: {
          optionsJson: JSON.stringify(options),
          identifiedItems: items.join(', '),
        },
      } as any);
    } catch (error) {
      Alert.alert('Hata', 'Hızlı Atıştırmalık başarısız oldu.');
    } finally {
      setSnackLoading(false);
    }
  };

  const pickFromGallery = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      await processAndNavigate(uri);
    }
  };

  // ── Ortak: Sıkıştır + Yönlendir ──────────────────────────────────────────
  const processAndNavigate = async (uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (manipulated.base64) {
      // Galeriden seçince de recipe-picker'a git (10 seçenek)
      router.push({ pathname: '/recipe-picker', params: { base64Image: manipulated.base64 } } as any);
    }
  };

  const firstName = userProfile?.displayName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'Şef';

  return (
    <ScreenBackground style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <LinearGradient
          colors={[colors.gradientStart, colors.gradientEnd]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.greeting}>Merhaba, {firstName}! 👋</Text>
            <Text style={styles.headerSubtitle}>Bugün ne pişirelim?</Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile' as any)} activeOpacity={0.8}>
            {userProfile?.photoBase64 ? (
              <Image source={{ uri: userProfile.photoBase64 }} style={[styles.avatarCircle, { borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)' }]} />
            ) : (
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>
                  {firstName.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* İstatistik Rozetleri */}
        <View style={styles.statsRow}>
          <View style={styles.statBadge}>
            <Ionicons name="heart" size={14} color={colors.primary} />
            <Text style={styles.statText}>{favoriteCount} Favori</Text>
          </View>
          <View style={styles.statBadge}>
            <Ionicons name="cart" size={14} color={colors.primary} />
            <Text style={styles.statText}>{shoppingCount} Alışveriş</Text>
          </View>
        </View>
      </LinearGradient>

      {/* ── Ana CTA Alanı ───────────────────────────────────── */}
      <View style={styles.ctaSection}>
        <Text style={styles.ctaTitle}>Dolabında ne var?</Text>
        <Text style={styles.ctaSubtitle}>
          Fotoğraf çek veya galeriden seç, AI şef tarifinizi hazırlasın
        </Text>

        {/* Büyük "Fotoğraf Çek" Butonu */}
        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={styles.mainCta}
            onPress={() => router.push('/camera' as any)}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[colors.gradientStart, colors.gradientEnd]}
              style={styles.mainCtaGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <View style={styles.mainCtaIconContainer}>
                <Ionicons name="camera" size={52} color="white" />
              </View>
              <Text style={styles.mainCtaText}>Dolabını Tara</Text>
              <Text style={styles.mainCtaSubText}>Fotoğraf çek</Text>
            </LinearGradient>
          </TouchableOpacity>
        </Animated.View>

        {/* "veya" Ayırıcı */}
        <View style={styles.orRow}>
          <View style={styles.orLine} />
          <Text style={styles.orText}>veya</Text>
          <View style={styles.orLine} />
        </View>

        {/* Galeriden Seç */}
        <TouchableOpacity
          style={styles.galleryButton}
          onPress={pickFromGallery}
          activeOpacity={0.85}
        >
          <Ionicons name="images-outline" size={22} color={colors.primary} />
          <Text style={styles.galleryButtonText}>Galeriden Fotoğraf Seç</Text>
        </TouchableOpacity>
      </View>

      {/* ── Kısa Yollar ─────────────────────────────────────── */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          onPress={() => router.push('/(tabs)/favorites' as any)}
          style={styles.shortcutCard}
        >
          <LinearGradient
            colors={isDark ? ['#331111', '#441111'] : ['#FFF0F0', '#FFE0E0']}
            style={styles.shortcutGradient}
          >
            <Ionicons name="heart" size={28} color={colors.error} />
            <Text style={styles.shortcutLabel}>Favoriler</Text>
            <Text style={styles.shortcutCount}>{favoriteCount} tarif</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/(tabs)/shopping' as any)}
          style={styles.shortcutCard}
        >
          <LinearGradient
            colors={isDark ? ['#113311', '#114411'] : ['#F0FFF4', '#DCFCE7']}
            style={styles.shortcutGradient}
          >
            <Ionicons name="cart" size={28} color={colors.secondary} />
            <Text style={styles.shortcutLabel}>Alışveriş</Text>
            <Text style={styles.shortcutCount}>{shoppingCount} ürün</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── Eğlence & Hızlı Modlar (Faz 4) ──────────────────── */}
      <View style={styles.actionRow}>
        <TouchableOpacity
          style={[styles.actionCard, snackLoading && styles.actionCardDisabled]}
          onPress={handleQuickSnack}
          disabled={snackLoading}
        >
          <Text style={styles.actionIcon}>⚡</Text>
          <Text style={styles.actionTitle}>{snackLoading ? 'Yükleniyor...' : 'Hızlı Atıştırmalık'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionCard}
          onPress={() => router.push('/guest' as any)}
        >
          <Text style={styles.actionIcon}>🏠</Text>
          <Text style={styles.actionTitle}>Misafir Modu</Text>
        </TouchableOpacity>
      </View>

      {/* ── Mevsimsel Öneriler ──────────────────────────────── */}
      <TouchableOpacity
        style={styles.seasonCard}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/assistant' as any)}
      >
        <LinearGradient
          colors={season.colors}
          style={styles.seasonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <Text style={styles.seasonEmoji}>{season.emoji}</Text>
          <View style={styles.seasonTextCol}>
            <Text style={styles.seasonTitle}>{season.label}</Text>
            <Text style={styles.seasonSub}>AI asistana sor →</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color="rgba(255,255,255,0.8)" />
        </LinearGradient>
      </TouchableOpacity>

      {/* ── Günlük Kalori Takibi ────────────────────────────── */}
      <View style={styles.calorieCard}>
        <View style={styles.calorieHeader}>
          <View>
            <Text style={styles.calorieTitle}>🔥 Bugünkü Kalori</Text>
            <Text style={styles.calorieValue}>{todayCalories} / {calorieGoal} kcal</Text>
          </View>
          <Text style={styles.caloriePercent}>
            {Math.min(Math.round((todayCalories / calorieGoal) * 100), 100)}%
          </Text>
        </View>
        <View style={styles.calorieBar}>
          <View
            style={[
              styles.calorieBarFill,
              {
                width: `${Math.min((todayCalories / calorieGoal) * 100, 100)}%`,
                backgroundColor: todayCalories > calorieGoal ? colors.error : colors.primary,
              },
            ]}
          />
        </View>
        {todayCalories === 0 && (
          <Text style={styles.calorieHint}>
            Tarif sayfasında "Bugün Yedim" butonuna basarak kalori ekleyebilirsin
          </Text>
        )}
      </View>

      {/* ── İpuçları ───────────────────────────────────────────── */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsSectionTitle}>💡 İpuçları</Text>
        {TIPS.map((tip, index) => (
          <View key={index} style={styles.tipRow}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
      {/* Alt Boşluk */}
      <View style={{ height: 100 }} />
      </ScrollView>
    </ScreenBackground>
  );
}

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  root: { flex: 1 },
  scrollContent: {
    paddingBottom: 40,
  },
  // ── Header ─────────────────────────────────────────────────
  header: {
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  greeting: {
    fontSize: Typography['2xl'],
    fontWeight: '800',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: Typography.base,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.25)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  avatarText: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: colors.white,
  },
  // ── İstatistikler ───────────────────────────────────────────
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  statText: {
    fontSize: Typography.sm,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  // ── CTA Bölümü ─────────────────────────────────────────────
  ctaSection: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing['2xl'],
    alignItems: 'center',
  },
  ctaTitle: {
    fontSize: Typography['3xl'],
    fontWeight: '800',
    color: colors.textPrimary,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontSize: Typography.base,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  // ── Ana Buton ──────────────────────────────────────────────
  mainCta: {
    width: 200,
    height: 200,
    borderRadius: 100,
    overflow: 'hidden',
    ...Shadow.lg,
  },
  mainCtaGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  mainCtaIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mainCtaText: {
    fontSize: Typography.lg,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.3,
  },
  mainCtaSubText: {
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.85)',
  },
  // ── Ayırıcı ────────────────────────────────────────────────
  orRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: Spacing.xl,
    width: '100%',
    gap: 12,
  },
  orLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  orText: {
    fontSize: Typography.sm,
    color: colors.textMuted,
    fontWeight: '500',
  },
  // ── Galeri Butonu ──────────────────────────────────────────
  galleryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    width: '100%',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    ...Shadow.sm,
  },
  galleryButtonText: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: colors.primary,
  },
  // ── Kısa Yollar ────────────────────────────────────────────
  shortcutsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
  },
  shortcutCard: {
    flex: 1,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  shortcutGradient: {
    padding: Spacing.base,
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.lg,
  },
  shortcutLabel: { fontSize: Typography.base, fontWeight: '700', color: colors.textPrimary },
  shortcutCount: { fontSize: Typography.sm, color: colors.textSecondary },
  // ── Aksiyon Butonları (Faz 4) ──────────────────────────────
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.xl,
    gap: 12,
    marginTop: Spacing.xl, // Butonları biraz daha aşağı ittik
    marginBottom: Spacing.xl,
    justifyContent: 'space-between',
  },
  actionCard: {
    width: '47%', // İki satır halinde sığsın ve yazılar sıkışmasın
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    ...Shadow.sm,
  },
  actionCardDisabled: { opacity: 0.6 },
  actionIcon: { fontSize: 24 },
  actionTitle: { fontSize: Typography.sm, fontWeight: '600', color: colors.textPrimary, flex: 1 },

  // ── İpuçları ───────────────────────────────────────────────
  tipsSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    backgroundColor: colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  tipsSectionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.sm,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // ── Mevsimsel Kart ─────────────────────────────────────────
  seasonCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    borderRadius: Radius.xl,
    overflow: 'hidden',
    ...Shadow.md,
  },
  seasonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: 14,
  },
  seasonEmoji: { fontSize: 36 },
  seasonTextCol: { flex: 1 },
  seasonTitle: { fontSize: Typography.lg, fontWeight: '800', color: '#fff' },
  seasonSub: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
  // ── Kalori Takibi ──────────────────────────────────────────
  calorieCard: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing.xl,
    backgroundColor: colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    gap: 10,
    ...Shadow.sm,
  },
  calorieHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  calorieTitle: { fontSize: Typography.base, fontWeight: '700', color: colors.textPrimary },
  calorieValue: { fontSize: Typography.sm, color: colors.textSecondary, marginTop: 2 },
  caloriePercent: { fontSize: Typography['2xl'], fontWeight: '800', color: colors.primary },
  calorieBar: {
    height: 10,
    backgroundColor: colors.border,
    borderRadius: 5,
    overflow: 'hidden',
  },
  calorieBarFill: { height: 10, borderRadius: 5 },
  calorieHint: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});
