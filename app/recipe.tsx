// ============================================================
// Fridge Chef — Tarif Ekranı (Firestore Entegrasyonlu)
// ============================================================

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
  Share,
} from 'react-native';
import CookingModeSlider from '../components/CookingModeSlider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRecipeFromImage } from '../services/geminiService';
import { addToFavorites, removeFromFavorites, addItemsToShoppingList, addItemsToPantry, getFavorites, addToHistory } from '../services/firestoreService';
import { NonFoodImageError, Recipe } from '../types';
import { useAuth } from '../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/Colors';

export default function RecipeScreen() {
  const { base64Image, fromFavorite, fromHistory, recipeJson } = useLocalSearchParams<{
    base64Image: string;
    fromFavorite: string;
    fromHistory: string;
    recipeJson: string;
  }>();

  const { user, userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<{ message: string; isNonFood: boolean } | null>(null);
  const [isFavorited, setIsFavorited] = useState(fromFavorite === 'true');
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [savingShoppingList, setSavingShoppingList] = useState(false);
  const [savingPantry, setSavingPantry] = useState(false);
  const [savedToPantry, setSavedToPantry] = useState(false);
  const [cookingModeVisible, setCookingModeVisible] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Favorilerden veya geçmişten açıldıysa doğrudan göster
    if ((fromFavorite === 'true' || fromHistory === 'true') && recipeJson) {
      try {
        setRecipe(JSON.parse(recipeJson));
      } catch {
        setError({ message: 'Tarif yüklenemedi.', isNonFood: false });
      }
      setLoading(false);
      return;
    }

    // Yeni görsel ile Gemini'ye sor
    const fetchRecipe = async () => {
      if (!base64Image) {
        setError({ message: 'Görsel bulunamadı.', isNonFood: false });
        setLoading(false);
        return;
      }

      try {
        const result = await getRecipeFromImage(
          base64Image,
          userProfile?.preferences ?? undefined
        );
        setRecipe(result);

        // Yeni tarif oluşturulduğunda otomatik geçmişe kaydet
        if (user) {
          addToHistory(user.uid, result).catch((err) =>
            console.error('[RecipeScreen] addToHistory err', err)
          );
        }
      } catch (err) {
        if (err instanceof NonFoodImageError) {
          setError({
            message: 'Lütfen sadece gıda malzemesi, buzdolabı veya yemek fotoğrafı yükleyin.',
            isNonFood: true,
          });
        } else {
          setError({
            message: 'Tarif oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.',
            isNonFood: false,
          });
          console.error('[RecipeScreen]', err);
        }
      } finally {
        setLoading(false);
      }
    };

    fetchRecipe();
  }, [base64Image, fromFavorite, fromHistory, recipeJson]);

  useEffect(() => {
    const checkFavorite = async () => {
      if (!user || !recipe) return;
      try {
        const favs = await getFavorites(user.uid);
        const existing = favs.find((f) => f.tarifAdi === recipe.tarifAdi);
        if (existing) {
          setIsFavorited(true);
          setFavoriteDocId(existing.id);
        } else {
          setIsFavorited(false);
          setFavoriteDocId(null);
        }
      } catch (err) {
        console.error('[RecipeScreen] checkFavorite err', err);
      }
    };
    checkFavorite();
  }, [user, recipe]);

  // ── Favoriye Ekle / Çıkar (Toggle) ─────────────────────────
  const handleFavoriteToggle = async () => {
    if (!user || !recipe || savingFavorite) return;
    setSavingFavorite(true);
    try {
      if (isFavorited && favoriteDocId) {
        // Favoriden çıkar
        await removeFromFavorites(user.uid, favoriteDocId);
        setIsFavorited(false);
        setFavoriteDocId(null);
        Alert.alert('💔 Favoriden Çıkarıldı', `"${recipe.tarifAdi}" favorilerinizden kaldırıldı.`);
      } else {
        // Favoriye ekle
        const docId = await addToFavorites(user.uid, recipe);
        setIsFavorited(true);
        setFavoriteDocId(docId);
        Alert.alert('❤️ Favorilere Eklendi', `"${recipe.tarifAdi}" favorilerinize kaydedildi.`);
      }
    } catch {
      Alert.alert('Hata', 'İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSavingFavorite(false);
    }
  };

  // ── Tarif Paylaş ───────────────────────────────────────────
  const handleShare = async () => {
    if (!recipe) return;
    const shareText = `🍽️ ${recipe.tarifAdi}\n⏱️ ${recipe.hazirlikSuresi} | 🔥 ${recipe.kaloriTahmini}\n\n📝 Malzemeler:\n${recipe.kullanilanMalzemeler.map((m) => '• ' + m).join('\n')}\n\n👨‍🍳 Yapılışı:\n${recipe.adimAdimYapilisi.map((s, i) => (i + 1) + '. ' + s).join('\n')}${recipe.ipuclari ? '\n\n💡 İpucu: ' + recipe.ipuclari : ''}\n\n— Fridge Chef 🧑‍🍳 ile oluşturuldu`;

    try {
      await Share.share({
        message: shareText,
        title: recipe.tarifAdi,
      });
    } catch (err) {
      console.error('[RecipeScreen] share err', err);
    }
  };

  // ── Kilere Kaydet ──────────────────────────────────────────
  const handleSaveToPantry = async () => {
    if (!user || !recipe || savedToPantry) return;
    setSavingPantry(true);
    try {
      const added = await addItemsToPantry(user.uid, recipe.kullanilanMalzemeler);
      setSavedToPantry(true);
      Alert.alert(
        '📦 Kilere Kaydedildi',
        added > 0
          ? `${added} malzeme kilerinize eklendi. Son tüketim tarihi eklemek için Kiler sekmesinize gidin.`
          : 'Bu malzemeler zaten kilerinizde mevcut.',
        [{ text: 'Tamam', style: 'cancel' }, {
          text: 'Kilere Git',
          onPress: () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            router.push('/(tabs)/pantry' as any);
          },
        }]
      );
    } catch {
      Alert.alert('Hata', 'Malzemeler kilere kaydedilemedi.');
    } finally {
      setSavingPantry(false);
    }
  };

  // ── Alışveriş Listesine Ekle ───────────────────────────────
  const handleAddToShopping = async () => {
    if (!user || !recipe || !recipe.eksikMalzemeler?.length) return;
    setSavingShoppingList(true);
    try {
      await addItemsToShoppingList(user.uid, recipe.eksikMalzemeler);
      Alert.alert(
        '🛒 Alışveriş Listesine Eklendi',
        `${recipe.eksikMalzemeler.length} malzeme listenize eklendi.`,
        [
          { text: 'Tamam', style: 'cancel' },
          {
            text: 'Listeye Git',
            onPress: () => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              router.push('/(tabs)/shopping' as any);
            },
          },
        ]
      );
    } catch {
      Alert.alert('Hata', 'Malzemeler eklenemedi.');
    } finally {
      setSavingShoppingList(false);
    }
  };

  // ── Yükleniyor ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingTitle}>Şef malzemeleri inceliyor...</Text>
        <Text style={styles.loadingSubtitle}>Harika bir tarif hazırlanıyor 👨‍🍳</Text>
      </View>
    );
  }

  // ── Hata ───────────────────────────────────────────────────
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <View style={[styles.errorIconContainer, error.isNonFood && styles.errorIconContainerNonFood]}>
          <Ionicons
            name={error.isNonFood ? 'fast-food-outline' : 'alert-circle-outline'}
            size={56}
            color={error.isNonFood ? Colors.warning : Colors.error}
          />
        </View>
        <Text style={styles.errorTitle}>
          {error.isNonFood ? 'Gıda Görseli Gerekli' : 'Bir Sorun Oluştu'}
        </Text>
        <Text style={styles.errorMessage}>{error.message}</Text>
        <TouchableOpacity style={styles.primaryButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="white" />
          <Text style={styles.primaryButtonText}>Geri Dön</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!recipe) return null;

  // ── Tarif ──────────────────────────────────────────────────
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>

      {/* Tarif Adı + Paylaş */}
      <View style={styles.titleRow}>
        <Text style={styles.recipeName}>{recipe.tarifAdi}</Text>
        <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
          <Ionicons name="share-outline" size={22} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Rozetler */}
      <View style={styles.badgesRow}>
        <View style={[styles.badge, styles.timeBadge]}>
          <Ionicons name="time-outline" size={16} color={Colors.white} />
          <Text style={styles.badgeText}>{recipe.hazirlikSuresi}</Text>
        </View>
        <View style={[styles.badge, styles.calorieBadge]}>
          <Ionicons name="flame-outline" size={16} color={Colors.white} />
          <Text style={styles.badgeText}>{recipe.kaloriTahmini}</Text>
        </View>
      </View>

      {/* Mevcut Malzemeler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✅ Mevcut Malzemeler</Text>
        {recipe.kullanilanMalzemeler.map((item, index) => (
          <View key={index} style={styles.ingredientRow}>
            <Ionicons name="ellipse" size={8} color={Colors.secondary} />
            <Text style={styles.ingredientText}>{item}</Text>
          </View>
        ))}
        {/* Kilere Kaydet Butonu */}
        <TouchableOpacity
          style={[styles.shoppingButton, savingPantry && styles.buttonDisabled]}
          onPress={handleSaveToPantry}
          disabled={savingPantry || savedToPantry}
        >
          {savingPantry ? (
            <ActivityIndicator size="small" color={Colors.primary} />
          ) : (
            <Ionicons
              name={savedToPantry ? 'checkmark-circle' : 'file-tray-full-outline'}
              size={18}
              color={Colors.primary}
            />
          )}
          <Text style={styles.shoppingButtonText}>
            {savedToPantry
              ? 'Kilere Kaydedildi'
              : savingPantry
              ? 'Kaydediliyor...'
              : 'Kilere Kaydet'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Eksik Malzemeler */}
      {recipe.eksikMalzemeler && recipe.eksikMalzemeler.length > 0 && (
        <View style={[styles.section, styles.missingSection]}>
          <Text style={styles.sectionTitle}>🛒 Eksik Malzemeler</Text>
          {recipe.eksikMalzemeler.map((item, index) => (
            <View key={index} style={styles.ingredientRow}>
              <Ionicons name="ellipse" size={8} color={Colors.warning} />
              <Text style={styles.ingredientText}>{item}</Text>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.shoppingButton, savingShoppingList && styles.buttonDisabled]}
            onPress={handleAddToShopping}
            disabled={savingShoppingList}
          >
            {savingShoppingList ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Ionicons name="add-circle-outline" size={18} color={Colors.primary} />
            )}
            <Text style={styles.shoppingButtonText}>
              {savingShoppingList ? 'Ekleniyor...' : 'Alışveriş Listesine Ekle'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Pişirmeye Başla Butonu */}
      <TouchableOpacity
        style={styles.cookingModeButton}
        onPress={() => setCookingModeVisible(true)}
        activeOpacity={0.85}
      >
        <Ionicons name="restaurant" size={22} color="white" />
        <View>
          <Text style={styles.cookingModeButtonTitle}>Pişirmeye Başla</Text>
          <Text style={styles.cookingModeButtonSubtitle}>Eller serbest mod — {recipe.adimAdimYapilisi.length} adım</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Adım Adım Yapılış */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Adım Adım Yapılışı</Text>
        {recipe.adimAdimYapilisi.map((step, index) => (
          <View key={index} style={styles.stepCard}>
            <View style={styles.stepNumberCircle}>
              <Text style={styles.stepNumber}>{index + 1}</Text>
            </View>
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ))}
      </View>

      {/* Şef İpucu */}
      {recipe.ipuclari && (
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={Colors.primary} />
          <Text style={styles.tipText}>{recipe.ipuclari}</Text>
        </View>
      )}

      {/* Pişirme Modu Modal */}
      <CookingModeSlider
        visible={cookingModeVisible}
        recipeName={recipe.tarifAdi}
        steps={recipe.adimAdimYapilisi}
        onClose={() => setCookingModeVisible(false)}
      />

      {/* Alt Butonlar */}
      <View style={styles.actionRow}>
        {/* Favorile / Favoriden Çıkar */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            styles.favoriteButton,
            isFavorited && styles.favoritedButton,
          ]}
          onPress={handleFavoriteToggle}
          disabled={savingFavorite}
        >
          {savingFavorite ? (
            <ActivityIndicator size="small" color={isFavorited ? Colors.white : Colors.error} />
          ) : (
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorited ? Colors.white : Colors.error}
            />
          )}
          <Text style={[styles.actionButtonText, { color: isFavorited ? Colors.white : Colors.error }]}>
            {isFavorited ? 'Favoriden Çıkar' : 'Favorile'}
          </Text>
        </TouchableOpacity>

        {/* Ana Sayfa */}
        <TouchableOpacity
          style={[styles.actionButton, styles.homeButton]}
          onPress={() => router.dismissAll()}
        >
          <Ionicons name="home-outline" size={20} color={Colors.white} />
          <Text style={[styles.actionButtonText, { color: Colors.white }]}>Ana Sayfa</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  contentContainer: { padding: Spacing.lg, paddingBottom: 60 },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: Spacing.xl,
    gap: 16,
  },
  loadingTitle: { fontSize: Typography['2xl'], fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  loadingSubtitle: { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center' },
  errorIconContainer: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: Colors.errorLight, justifyContent: 'center', alignItems: 'center',
  },
  errorIconContainerNonFood: { backgroundColor: '#FEF3C7' },
  errorTitle: { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center' },
  errorMessage: { fontSize: Typography.base, color: Colors.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 280 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: Colors.primary, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: Radius.xl, marginTop: 8, ...Shadow.md,
  },
  primaryButtonText: { color: Colors.white, fontSize: Typography.lg, fontWeight: '700' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
    gap: 12,
  },
  recipeName: {
    flex: 1,
    fontSize: Typography['3xl'], fontWeight: '800', color: Colors.textPrimary,
    textAlign: 'center',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.primary,
    ...Shadow.sm,
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: Spacing.xl },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.full },
  timeBadge: { backgroundColor: Colors.info },
  calorieBadge: { backgroundColor: Colors.primary },
  badgeText: { color: Colors.white, fontWeight: '700', fontSize: Typography.sm },
  section: { marginBottom: Spacing.xl },
  missingSection: {
    backgroundColor: '#FEF9EC', padding: Spacing.base,
    borderRadius: Radius.lg, borderLeftWidth: 4, borderLeftColor: Colors.warning,
  },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.md },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  ingredientText: { fontSize: Typography.base, color: Colors.textSecondary, flex: 1 },
  shoppingButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: Colors.border,
  },
  shoppingButtonText: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  stepCard: {
    flexDirection: 'row', backgroundColor: Colors.surface,
    padding: Spacing.base, borderRadius: Radius.lg,
    marginBottom: Spacing.sm, gap: 12, ...Shadow.sm,
  },
  stepNumberCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: Colors.primary, justifyContent: 'center',
    alignItems: 'center', flexShrink: 0,
  },
  stepNumber: { color: Colors.white, fontWeight: '800', fontSize: Typography.sm },
  stepText: { flex: 1, fontSize: Typography.base, color: Colors.textSecondary, lineHeight: 24 },
  tipCard: {
    flexDirection: 'row', gap: 10, backgroundColor: Colors.surfaceElevated,
    padding: Spacing.base, borderRadius: Radius.lg,
    borderLeftWidth: 4, borderLeftColor: Colors.primary, marginBottom: Spacing.xl,
  },
  tipText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  actionRow: { flexDirection: 'row', gap: 12 },
  actionButton: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: Radius.lg, ...Shadow.sm,
  },
  favoriteButton: { backgroundColor: Colors.surface, borderWidth: 2, borderColor: Colors.error },
  favoritedButton: { backgroundColor: Colors.error, borderColor: Colors.error },
  homeButton: { backgroundColor: Colors.textPrimary },
  actionButtonText: { fontSize: Typography.base, fontWeight: '700' },
  cookingModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#1A1A2E',
    borderRadius: Radius.lg,
    padding: Spacing.base,
    paddingVertical: 18,
    marginBottom: Spacing.xl,
    borderWidth: 1,
    borderColor: 'rgba(255, 140, 0, 0.35)',
    ...Shadow.md,
  },
  cookingModeButtonTitle: {
    fontSize: Typography.lg,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  cookingModeButtonSubtitle: {
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.55)',
    marginTop: 2,
  },
});
