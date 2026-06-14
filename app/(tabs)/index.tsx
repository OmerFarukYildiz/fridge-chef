// ============================================================
// Fridge Chef — Ana Ekran (Home)
// ============================================================
// Merkezi "Dolabını Tara" CTA butonu ile temiz, iştah açıcı
// bir giriş sayfası. Kullanıcıya hoş geldin mesajı ve
// son tarif istatistikleri gösterilir.
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Easing,
  Image,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../../context/AuthContext';
import { getFavorites, getShoppingList } from '../../services/firestoreService';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';

// ── Hızlı İpucu Kartları ─────────────────────────────────────
const TIPS = [
  { icon: '📸', text: 'Buzdolabını açık fotoğrafla — tüm malzemeleri görsün' },
  { icon: '🌱', text: 'Diyet tercihlerini kayıt sırasında ayarladın' },
  { icon: '🛒', text: 'Eksik malzemeleri tek tıkla alışveriş listesine ekle' },
  { icon: '❤️', text: 'Beğendiğin tarifleri favorilere kaydet' },
];

export default function HomeScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [shoppingCount, setShoppingCount] = useState(0);

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

    // İstatistikleri yükle
    if (user) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    if (!user) return;
    try {
      const [favs, shopping] = await Promise.all([
        getFavorites(user.uid),
        getShoppingList(user.uid),
      ]);
      setFavoriteCount(favs.length);
      setShoppingCount(shopping.filter((i) => !i.checked).length);
    } catch {
      // Sessizce geç
    }
  };

  // ── Galeri'den Resim Seç ─────────────────────────────────────
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

  // ── Ortak: Sıkıştır + Yönlendir ──────────────────────────────
  const processAndNavigate = async (uri: string) => {
    const manipulated = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: 800 } }],
      { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    if (manipulated.base64) {
      router.push({ pathname: '/recipe', params: { base64Image: manipulated.base64 } });
    }
  };

  const firstName = userProfile?.displayName?.split(' ')[0] ?? user?.displayName?.split(' ')[0] ?? 'Şef';

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ──────────────────────────────────────────── */}
      <LinearGradient
        colors={[Colors.gradientStart, Colors.gradientEnd]}
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
            <Ionicons name="heart" size={14} color={Colors.primary} />
            <Text style={styles.statText}>{favoriteCount} Favori</Text>
          </View>
          <View style={styles.statBadge}>
            <Ionicons name="cart" size={14} color={Colors.primary} />
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
            onPress={() => router.push('/camera')}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={[Colors.gradientStart, Colors.gradientEnd]}
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
          <Ionicons name="images-outline" size={22} color={Colors.primary} />
          <Text style={styles.galleryButtonText}>Galeriden Fotoğraf Seç</Text>
        </TouchableOpacity>
      </View>

      {/* ── Kısa Yollar ─────────────────────────────────────── */}
      <View style={styles.shortcutsRow}>
        <TouchableOpacity
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/(tabs)/favorites' as any)}
          style={styles.shortcutCard}
        >
          <LinearGradient
            colors={['#FFF0F0', '#FFE0E0']}
            style={styles.shortcutGradient}
          >
            <Ionicons name="heart" size={28} color={Colors.error} />
            <Text style={styles.shortcutLabel}>Favoriler</Text>
            <Text style={styles.shortcutCount}>{favoriteCount} tarif</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          onPress={() => router.push('/(tabs)/shopping' as any)}
          style={styles.shortcutCard}
        >
          <LinearGradient
            colors={['#F0FFF4', '#DCFCE7']}
            style={styles.shortcutGradient}
          >
            <Ionicons name="cart" size={28} color={Colors.secondary} />
            <Text style={styles.shortcutLabel}>Alışveriş</Text>
            <Text style={styles.shortcutCount}>{shoppingCount} ürün</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>

      {/* ── İpuçları ────────────────────────────────────────── */}
      <View style={styles.tipsSection}>
        <Text style={styles.tipsSectionTitle}>💡 İpuçları</Text>
        {TIPS.map((tip, index) => (
          <View key={index} style={styles.tipRow}>
            <Text style={styles.tipIcon}>{tip.icon}</Text>
            <Text style={styles.tipText}>{tip.text}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
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
    color: Colors.white,
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
    color: Colors.white,
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
    backgroundColor: 'rgba(255,255,255,0.25)',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  statText: {
    fontSize: Typography.sm,
    color: Colors.white,
    fontWeight: '600',
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
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  ctaSubtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
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
    color: Colors.white,
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
    backgroundColor: Colors.border,
  },
  orText: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
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
    borderColor: Colors.primary,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    ...Shadow.sm,
  },
  galleryButtonText: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.primary,
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
  shortcutLabel: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  shortcutCount: {
    fontSize: Typography.xs,
    color: Colors.textSecondary,
  },
  // ── İpuçları ───────────────────────────────────────────────
  tipsSection: {
    marginHorizontal: Spacing.xl,
    marginTop: Spacing['2xl'],
    backgroundColor: Colors.surface,
    borderRadius: Radius.xl,
    padding: Spacing.base,
    ...Shadow.sm,
  },
  tipsSectionTitle: {
    fontSize: Typography.base,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
  },
  tipRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  tipIcon: {
    fontSize: 18,
  },
  tipText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
});
