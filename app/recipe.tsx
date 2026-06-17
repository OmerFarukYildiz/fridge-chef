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
  TextInput,
  Modal,
} from 'react-native';
import CookingModeSlider from '../components/CookingModeSlider';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getRecipeFromImage, getIngredientSubstitution, customizeRecipe, getRecipeFromText } from '../services/geminiService';
import {
  addToFavorites,
  removeFromFavorites,
  addItemsToPantry,
  addItemsToShoppingList,
  addCaloriesToday,
  updateFavoriteRatingAndNote,
  addLeftover,
  getFavorites,
  addToHistory,
  getPantryItems,
  shareToFeed,
} from '../services/firestoreService';
import { NonFoodImageError, Recipe } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppThemeColors, Typography, Spacing, Radius, Shadow } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';

export default function RecipeScreen() {
  const { base64Image, fromFavorite, fromHistory, fromPicker, recipeJson, recipeName } = useLocalSearchParams<{
    base64Image: string;
    fromFavorite: string;
    fromHistory: string;
    fromPicker: string;
    recipeJson: string;
    recipeName: string;
  }>();

  const { user, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [loading, setLoading] = useState(true);
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState<{ message: string; isNonFood: boolean } | null>(null);
  const [isFavorited, setIsFavorited] = useState(fromFavorite === 'true');
  const [favoriteDocId, setFavoriteDocId] = useState<string | null>(null);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [savingShoppingList, setSavingShoppingList] = useState(false);
  const [substituteLoading, setSubstituteLoading] = useState<string | null>(null);
  const [savingPantry, setSavingPantry] = useState(false);
  const [savedToPantry, setSavedToPantry] = useState(false);
  const [cookingModeVisible, setCookingModeVisible] = useState(false);
  const [portion, setPortion] = useState(1);
  // Puanlama & Not
  const [rating, setRating] = useState(0);
  const [note, setNote] = useState('');
  const [savingRating, setSavingRating] = useState(false);
  // Kalori Takibi
  const [addedCalories, setAddedCalories] = useState(false);
  const [customizeModalVisible, setCustomizeModalVisible] = useState(false);
  const [customizeText, setCustomizeText] = useState('');
  const [customizing, setCustomizing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Favorilerden, geçmişten veya seçim ekranından açıldıysa doğrudan göster
    if ((fromFavorite === 'true' || fromHistory === 'true' || fromPicker === 'true') && recipeJson) {
      try {
        const parsed = JSON.parse(recipeJson);
        setRecipe(parsed);
        // Picker'dan geliyorsa (yeni tarif) geçmişe kaydet
        if (fromPicker === 'true' && user) {
          addToHistory(user.uid, parsed).catch(() => {});
        }
      } catch {
        setError({ message: 'Tarif yüklenemedi.', isNonFood: false });
      }
      setLoading(false);
      return;
    }

    const fetchRecipe = async () => {
      // Metin tabanlı tarif talebi varsa
      if (recipeName) {
        try {
          const result = await getRecipeFromText(recipeName, userProfile ?? undefined);
          setRecipe(result);
          if (user) {
            addToHistory(user.uid, result).catch((err) =>
              console.error('[RecipeScreen] addToHistory err', err)
            );
          }
        } catch (err) {
          setError({
            message: 'Tarif oluşturulurken bir sorun oluştu. Lütfen tekrar deneyin.',
            isNonFood: false,
          });
          console.error('[RecipeScreen] getRecipeFromText error:', err);
        } finally {
          setLoading(false);
        }
        return;
      }

      // Yeni görsel ile Gemini'ye sor
      if (!base64Image) {
        setError({ message: 'Görsel bulunamadı.', isNonFood: false });
        setLoading(false);
        return;
      }

      try {
        const result = await getRecipeFromImage(
          base64Image,
          userProfile ?? undefined
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
  }, [base64Image, fromFavorite, fromHistory, recipeJson, recipeName]);

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

  // Favori detay bilgilerini (puan, not) yükle
  useEffect(() => {
    if (fromFavorite === 'true' && recipeJson) {
      try {
        const parsed = JSON.parse(recipeJson);
        if (parsed.rating) setRating(parsed.rating);
        if (parsed.note) setNote(parsed.note);
      } catch { /* ignore */ }
    }
  }, [fromFavorite, recipeJson]);

  // ── Puanlamayı Kaydet ─────────────────────────────────────────────────
  const handleSaveRating = async () => {
    if (!user || !favoriteDocId || savingRating) return;
    setSavingRating(true);
    try {
      await updateFavoriteRatingAndNote(user.uid, favoriteDocId, rating, note);
      Alert.alert('⭐ Kaydedildi', 'Puan ve notunuz kaydedildi.');
    } catch {
      Alert.alert('Hata', 'Puanlama kaydedilemedi.');
    } finally {
      setSavingRating(false);
    }
  };
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

  // ── Kalori Ekle & Artık Yemek (Leftover) ──────────────────────────
  const handleAddCalories = async () => {
    if (!user || !recipe || addedCalories) return;
    
    // Kalori tahmininden sayıyı çıkar ("450 kcal" veya "~400 kkal")
    const kalori = recipe.kaloriTahmini || "0 kcal";
    const match = kalori.match(/(\d+)/);
    if (!match) {
      Alert.alert('Hata', 'Kalori bilgisi okunamadı.');
      return;
    }
    const kcal = parseInt(match[1], 10) * portion;

    const processConsumption = async (hasLeftovers: boolean) => {
      try {
        await addCaloriesToday(user.uid, kcal);
        if (hasLeftovers) {
          // Eğer 2 porsiyon yapıp 1 porsiyon artırdıysa bunu basitçe metin olarak kaydet
          await addLeftover(user.uid, recipe.tarifAdi, `Kalan miktar (Toplam yapılmıştı: ${portion} porsiyon)`);
        }
        setAddedCalories(true);
        Alert.alert(
          '✅ Kaydedildi',
          `${kcal} kcal bugünkü listenize eklendi! ${hasLeftovers ? '\nArtan yemek kilerinize "Kalanlar" olarak eklendi.' : ''}`
        );
      } catch {
        Alert.alert('Hata', 'İşlem gerçekleştirilemedi.');
      }
    };

    Alert.alert(
      'Yemeği Bitirdin mi?',
      'Hazırladığın yemeğin tamamını yedin mi, yoksa yarına arttı mı?',
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Hepsini Bitirdim', onPress: () => processConsumption(false) },
        { text: 'Birazı Arttı (Yarına)', onPress: () => processConsumption(true) },
      ]
    );
  };

  // ── Tarif Paylaş ───────────────────────────────────────────
  const handleShare = async () => {
    if (!recipe) return;
    const nutritionText = recipe.besinDegerleri
      ? `\n🥩 Protein: ${recipe.besinDegerleri.protein} | 🌾 Karbonhidrat: ${recipe.besinDegerleri.karbonhidrat} | 🧈 Yağ: ${recipe.besinDegerleri.yag}`
      : '';
    const shareText = `🍽️ ${recipe.tarifAdi}\n⏱️ ${recipe.hazirlikSuresi} | 🔥 ${recipe.kaloriTahmini || "Belirtilmemiş"}${nutritionText}\n\n📝 Malzemeler:\n${recipe.kullanilanMalzemeler.map((m) => '• ' + m).join('\n')}\n\n👨‍🍳 Yapılışı:\n${(recipe.adimAdimYapilisi || []).map((s, i) => (i + 1) + '. ' + s).join('\n')}${recipe.ipuclari ? '\n\n💡 İpucu: ' + recipe.ipuclari : ''}\n\n— Fridge Chef 🧑‍🍳 ile oluşturuldu`;
    try {
      await Share.share({ message: shareText, title: recipe.tarifAdi });
    } catch (err) {
      console.error('[RecipeScreen] share err', err);
    }
  };

  // ── Sosyal Akışa (Feed) Gönder ──────────────────────────────
  const handleShareToFeed = async () => {
    if (!user || !userProfile || !recipe) return;
    try {
      await shareToFeed({
        userId: user.uid,
        userName: userProfile.displayName || 'Şef',
        userPhoto: userProfile.photoBase64 || undefined,
        recipe: recipe
      });
      Alert.alert('Başarılı', 'Tarifiniz Sosyal Akış\'ta paylaşıldı! 🌍');
    } catch (e) {
      Alert.alert('Hata', 'Paylaşılamadı.');
    }
  };

  // ── Kilere Kaydet ──────────────────────────────────────────
  const handleSaveToPantry = async () => {
    if (!user || !recipe || savedToPantry) return;
    setSavingPantry(true);
    try {
      const targetId = userProfile?.familyId || user.uid;
      const added = await addItemsToPantry(targetId, recipe.kullanilanMalzemeler);
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
      const targetId = userProfile?.familyId || user.uid;
      await addItemsToShoppingList(targetId, recipe.eksikMalzemeler);
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

  // ── İkame (Substitute) Bul ─────────────────────────────────
  const handleSubstitute = async (ingredient: string) => {
    if (!user) return;
    setSubstituteLoading(ingredient);
    try {
      const targetId = userProfile?.familyId || user.uid;
      const pantry = await getPantryItems(targetId);
      const pantryNames = pantry.map((i) => i.name);
      const suggestions = await getIngredientSubstitution(ingredient, pantryNames, userProfile ?? undefined);
      
      if (suggestions.length > 0) {
        Alert.alert('🔄 İkame Önerileri', suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n\n'));
      } else {
        Alert.alert('Sonuç Yok', 'Bu malzeme için uygun bir ikame bulunamadı.');
      }
    } catch {
      Alert.alert('Hata', 'İkame bulunurken bir sorun oluştu.');
    } finally {
      setSubstituteLoading(null);
    }
  };

  // ── Tarifi Kişiselleştir (Customize) ──────────────────────
  const handleCustomize = async () => {
    if (!user || !recipe || !customizeText.trim()) return;
    setCustomizing(true);
    try {
      const newRecipe = await customizeRecipe(recipe, customizeText.trim(), userProfile ?? undefined);
      setRecipe(newRecipe);
      setCustomizeModalVisible(false);
      setCustomizeText('');
      Alert.alert('✅ Başarılı', 'Tarif isteğine göre güncellendi!');
    } catch {
      Alert.alert('Hata', 'Tarif güncellenirken bir hata oluştu.');
    } finally {
      setCustomizing(false);
    }
  };

  // ── Yükleniyor ─────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
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
            color={error.isNonFood ? colors.warning : colors.error}
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

      {/* Tarif Adı + Paylaş + Kişiselleştir */}
      <View style={styles.titleRow}>
        <Text style={styles.recipeName}>{recipe.tarifAdi}</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.shareButton} onPress={() => setCustomizeModalVisible(true)} activeOpacity={0.7}>
            <Ionicons name="color-wand-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.shareButton} onPress={handleShare} activeOpacity={0.7}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Rozetler */}
      <View style={styles.badgesRow}>
        <View style={[styles.badge, styles.timeBadge]}>
          <Ionicons name="time-outline" size={16} color={colors.white} />
          <Text style={styles.badgeText}>{recipe.hazirlikSuresi}</Text>
        </View>
        <View style={[styles.badge, styles.calorieBadge]}>
          <Ionicons name="flame-outline" size={16} color={colors.white} />
          <Text style={styles.badgeText}>{recipe.kaloriTahmini || "Belirtilmemiş"}</Text>
        </View>
        {recipe.zorlukSeviyesi && (
          <View style={[styles.badge, styles.difficultyBadge]}>
            <Text style={styles.badgeText}>{recipe.zorlukSeviyesi}</Text>
          </View>
        )}
      </View>

      {/* Besin Değerleri */}
      {recipe.besinDegerleri && (
        <View style={styles.nutritionRow}>
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>🥩 Protein</Text>
            <Text style={styles.nutritionValue}>{recipe.besinDegerleri.protein}</Text>
          </View>
          <View style={styles.nutritionDivider} />
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>🌾 Karbonhidrat</Text>
            <Text style={styles.nutritionValue}>{recipe.besinDegerleri.karbonhidrat}</Text>
          </View>
          <View style={styles.nutritionDivider} />
          <View style={styles.nutritionItem}>
            <Text style={styles.nutritionLabel}>🧈 Yağ</Text>
            <Text style={styles.nutritionValue}>{recipe.besinDegerleri.yag}</Text>
          </View>
        </View>
      )}

      {/* Porsiyon Ayarlama */}
      <View style={styles.portionRow}>
        <Text style={styles.portionLabel}>👥 Porsiyon</Text>
        <View style={styles.portionControls}>
          <TouchableOpacity
            style={[styles.portionBtn, portion <= 1 && styles.portionBtnDisabled]}
            onPress={() => setPortion((p) => Math.max(1, p - 1))}
            disabled={portion <= 1}
          >
            <Ionicons name="remove" size={18} color={portion <= 1 ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
          <Text style={styles.portionCount}>{portion}x</Text>
          <TouchableOpacity
            style={[styles.portionBtn, portion >= 10 && styles.portionBtnDisabled]}
            onPress={() => setPortion((p) => Math.min(10, p + 1))}
            disabled={portion >= 10}
          >
            <Ionicons name="add" size={18} color={portion >= 10 ? colors.textMuted : colors.primary} />
          </TouchableOpacity>
        </View>
        {portion !== 1 && (
          <Text style={styles.portionNote}>(malzeme miktarları {portion}x çarpılmıştır)</Text>
        )}
      </View>

      {/* Mevcut Malzemeler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✅ Mevcut Malzemeler</Text>
        {recipe.kullanilanMalzemeler.map((item, index) => (
          <View key={index} style={styles.ingredientRow}>
            <Ionicons name="ellipse" size={8} color={colors.secondary} />
            <Text style={styles.ingredientText}>
              {portion !== 1 ? `${item} (×${portion})` : item}
            </Text>
          </View>
        ))}
        {/* Kilere Kaydet Butonu */}
        <TouchableOpacity
          style={[styles.shoppingButton, savingPantry && styles.buttonDisabled]}
          onPress={handleSaveToPantry}
          disabled={savingPantry || savedToPantry}
        >
          {savingPantry ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Ionicons
              name={savedToPantry ? 'checkmark-circle' : 'file-tray-full-outline'}
              size={18}
              color={colors.primary}
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
            <View key={index} style={[styles.ingredientRow, { justifyContent: 'space-between' }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                <Ionicons name="ellipse" size={8} color={colors.warning} />
                <Text style={[styles.ingredientText, { flex: 1 }]}>{item}</Text>
              </View>
              <TouchableOpacity
                style={{ padding: 4 }}
                onPress={() => handleSubstitute(item)}
                disabled={substituteLoading === item}
              >
                {substituteLoading === item ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            </View>
          ))}
          <TouchableOpacity
            style={[styles.shoppingButton, savingShoppingList && styles.buttonDisabled]}
            onPress={handleAddToShopping}
            disabled={savingShoppingList}
          >
            {savingShoppingList ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
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
        <View style={{ flex: 1 }}>
          <Text style={styles.cookingModeButtonTitle}>Pişirmeye Başla</Text>
          <Text style={styles.cookingModeButtonSubtitle}>Eller serbest mod — {recipe.adimAdimYapilisi?.length || 0} adım</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.cookingModeButton, { backgroundColor: '#8B5CF6', marginTop: 10 }]}
        onPress={() => {
          router.push({
            pathname: '/story' as any,
            params: {
              recipeName: recipe.tarifAdi,
              stepsJson: JSON.stringify(recipe.adimAdimYapilisi ?? []),
            },
          });
        }}
        activeOpacity={0.85}
      >
        <Ionicons name="play-circle" size={24} color="white" />
        <View style={{ flex: 1 }}>
          <Text style={styles.cookingModeButtonTitle}>Hikaye Modunda İzle</Text>
          <Text style={styles.cookingModeButtonSubtitle}>Adımları tam ekran gör</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.7)" />
      </TouchableOpacity>

      {/* Puanlama & Not Paneli — sadece favorilerde göster */}
      {isFavorited && (
        <View style={styles.ratingPanel}>
          <Text style={styles.sectionTitle}>⭐ Değerlendirmem</Text>
          {/* Yıldız Seçici */}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <TouchableOpacity key={star} onPress={() => setRating(star)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons
                  name={star <= rating ? 'star' : 'star-outline'}
                  size={34}
                  color={star <= rating ? '#F59E0B' : colors.textMuted}
                />
              </TouchableOpacity>
            ))}
          </View>
          {/* Not Alanı */}
          <TextInput
            style={styles.noteInput}
            placeholder="Notunuzu buraya yazın... (örn: Biraz daha tuz ekledim)"
            placeholderTextColor={colors.textMuted}
            value={note}
            onChangeText={setNote}
            multiline
            numberOfLines={3}
          />
          <TouchableOpacity
            style={[styles.ratingSubmitBtn, savingRating && styles.buttonDisabled]}
            onPress={handleSaveRating}
            disabled={savingRating || rating === 0}
          >
            {savingRating ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.ratingSubmitText}>Değerlendirmeyi Kaydet</Text>
            )}
          </TouchableOpacity>
        </View>
      )}

      {/* Bugün Yedim — Kalori Takibi */}
      <TouchableOpacity
        style={[styles.todayAteBtn, addedCalories && styles.todayAteBtnDone]}
        onPress={handleAddCalories}
        disabled={addedCalories}
        activeOpacity={0.85}
      >
        <Ionicons name={addedCalories ? 'checkmark-circle' : 'add-circle-outline'} size={22} color="white" />
        <Text style={styles.todayAteBtnText}>
          {addedCalories ? 'Bugün Yedim ✓' : `Bugün Yedim (+${recipe.kaloriTahmini || 0})`}
        </Text>
      </TouchableOpacity>

      {/* Adım Adım Yapılış */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📋 Adım Adım Yapılışı</Text>
        {recipe.adimAdimYapilisi && recipe.adimAdimYapilisi.length > 0 ? (
          recipe.adimAdimYapilisi.map((step, index) => (
            <View key={index} style={styles.stepCard}>
              <View style={styles.stepNumberCircle}>
                <Text style={styles.stepNumber}>{index + 1}</Text>
              </View>
              <Text style={styles.stepText}>{step}</Text>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textSecondary }}>Adım bulunamadı.</Text>
        )}
      </View>

      {/* Şef İpucu */}
      {recipe.ipuclari && (
        <View style={styles.tipCard}>
          <Ionicons name="bulb-outline" size={20} color={colors.primary} />
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

      {/* Kişiselleştirme Modal */}
      <Modal visible={customizeModalVisible} transparent animationType="fade" onRequestClose={() => setCustomizeModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>✨ Tarifi Kişiselleştir</Text>
            <Text style={styles.modalSub}>Neyi değiştirmek istersin? (örn: "Süt yerine badem sütü kullan" veya "Daha acı yap")</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="İsteğini yaz..."
              placeholderTextColor={colors.textMuted}
              value={customizeText}
              onChangeText={setCustomizeText}
              multiline
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalBtnCancel} onPress={() => setCustomizeModalVisible(false)} disabled={customizing}>
                <Text style={styles.modalBtnCancelText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtnConfirm, customizing && styles.buttonDisabled]} onPress={handleCustomize} disabled={customizing || !customizeText.trim()}>
                {customizing ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.modalBtnConfirmText}>Yeniden Yaz</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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
            <ActivityIndicator size="small" color={isFavorited ? colors.white : colors.error} />
          ) : (
            <Ionicons
              name={isFavorited ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorited ? colors.white : colors.error}
            />
          )}
          <Text style={[styles.actionButtonText, { color: isFavorited ? colors.white : colors.error }]}>
            {isFavorited ? 'Favoriden Çıkar' : 'Favorile'}
          </Text>
        </TouchableOpacity>

        {/* Akışta Paylaş */}
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: '#3B82F6', borderColor: '#3B82F6' }]}
          onPress={handleShareToFeed}
        >
          <Ionicons name="planet-outline" size={20} color={colors.white} />
          <Text style={[styles.actionButtonText, { color: colors.white }]}>Akışta Paylaş</Text>
        </TouchableOpacity>

        {/* Ana Sayfa */}
        <TouchableOpacity
          style={[styles.actionButton, styles.homeButton]}
          onPress={() => router.dismissAll()}
        >
          <Ionicons name="home-outline" size={20} color={colors.background} />
          <Text style={[styles.actionButtonText, { color: colors.background }]}>Ana Sayfa</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contentContainer: { paddingBottom: 60, padding: Spacing.lg },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, gap: 16, backgroundColor: colors.background },
  loadingTitle: { fontSize: Typography['2xl'], fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  loadingSubtitle: { fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center' },
  errorIconContainer: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: colors.errorLight, justifyContent: 'center', alignItems: 'center',
  },
  errorIconContainerNonFood: { backgroundColor: '#FEF3C7' },
  errorTitle: { fontSize: Typography.xl, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  errorMessage: { fontSize: Typography.base, color: colors.textSecondary, textAlign: 'center', lineHeight: 24, maxWidth: 280 },
  primaryButton: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: colors.primary, paddingVertical: 14, paddingHorizontal: 28,
    borderRadius: Radius.xl, marginTop: 8, ...Shadow.md,
  },
  primaryButtonText: { color: colors.white, fontSize: Typography.lg, fontWeight: '700' },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: Spacing.base,
    gap: 12,
  },
  recipeName: {
    flex: 1,
    fontSize: Typography['3xl'], fontWeight: '800', color: colors.textPrimary,
    textAlign: 'center',
  },
  shareButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    ...Shadow.sm,
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: Spacing.xl },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: Radius.full },
  timeBadge: { backgroundColor: colors.info },
  calorieBadge: { backgroundColor: colors.primary },
  difficultyBadge: { backgroundColor: '#6B7280' },
  badgeText: { color: colors.white, fontWeight: '700', fontSize: Typography.sm },
  // ── Besin Değerleri ──────────────────────────────────────
  nutritionRow: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  nutritionItem: { alignItems: 'center', flex: 1 },
  nutritionLabel: { fontSize: 11, color: colors.textMuted, fontWeight: '500', marginBottom: 4, textAlign: 'center' },
  nutritionValue: { fontSize: Typography.base, fontWeight: '800', color: colors.textPrimary },
  nutritionDivider: { width: 1, height: 36, backgroundColor: colors.border },
  // ── Porsiyon ─────────────────────────────────────────────
  portionRow: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
    gap: 8,
  },
  portionLabel: { fontSize: Typography.base, fontWeight: '700', color: colors.textPrimary },
  portionControls: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  portionBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FFF4E6', borderWidth: 1.5, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
  },
  portionBtnDisabled: { borderColor: colors.border, backgroundColor: colors.background },
  portionCount: { fontSize: Typography.xl, fontWeight: '800', color: colors.primary, minWidth: 40, textAlign: 'center' },
  portionNote: { fontSize: Typography.xs, color: colors.textMuted, fontStyle: 'italic' },
  section: { marginBottom: Spacing.xl },
  missingSection: {
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : '#FEF9EC', padding: Spacing.base,
    borderRadius: Radius.lg, borderLeftWidth: 4, borderLeftColor: colors.warning,
  },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: Spacing.md },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  ingredientText: { fontSize: Typography.base, color: colors.textSecondary, flex: 1 },
  shoppingButton: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: Spacing.sm, paddingTop: Spacing.sm,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  shoppingButtonText: { color: colors.primary, fontSize: Typography.sm, fontWeight: '600' },
  buttonDisabled: { opacity: 0.6 },
  stepCard: {
    flexDirection: 'row', backgroundColor: colors.surface,
    padding: Spacing.base, borderRadius: Radius.lg,
    marginBottom: Spacing.sm, gap: 12, ...Shadow.sm,
  },
  stepNumberCircle: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primary, justifyContent: 'center',
    alignItems: 'center', flexShrink: 0,
  },
  stepNumber: { color: colors.white, fontWeight: '800', fontSize: Typography.sm },
  stepText: { flex: 1, fontSize: Typography.base, color: colors.textSecondary, lineHeight: 24 },
  tipCard: {
    flexDirection: 'row', gap: 10, backgroundColor: colors.surfaceElevated,
    padding: Spacing.base, borderRadius: Radius.lg,
    borderLeftWidth: 4, borderLeftColor: colors.primary, marginBottom: Spacing.xl,
  },
  tipText: { flex: 1, fontSize: Typography.sm, color: colors.textSecondary, lineHeight: 22, fontStyle: 'italic' },
  actionRow: { flexDirection: 'column', gap: 12 },
  actionButton: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: Radius.lg, ...Shadow.sm,
  },
  favoriteButton: { backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.error },
  favoritedButton: { backgroundColor: colors.error, borderColor: colors.error },
  homeButton: { backgroundColor: colors.textPrimary },
  actionButtonText: {
    fontSize: Typography.sm,
    fontWeight: '700',
  },
  // ── Modal ──────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalContainer: {
    backgroundColor: colors.surface,
    padding: Spacing.xl,
    borderRadius: Radius.lg,
    ...Shadow.lg,
  },
  modalTitle: { fontSize: Typography.lg, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  modalSub: { fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing.base },
  modalInput: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: 12,
    fontSize: Typography.base,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    marginBottom: Spacing.xl,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalBtnCancel: { flex: 1, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md },
  modalBtnCancelText: { color: colors.textSecondary, fontWeight: '600' },
  modalBtnConfirm: { flex: 1, padding: 12, alignItems: 'center', backgroundColor: colors.primary, borderRadius: Radius.md },
  modalBtnConfirmText: { color: colors.white, fontWeight: '700' },
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
  // ── Puanlama & Not ──────────────────────────────────────────
  ratingPanel: {
    backgroundColor: colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.base,
    marginBottom: Spacing.xl,
    gap: 12,
    ...Shadow.sm,
  },
  starsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  noteInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: 12,
    fontSize: Typography.base,
    color: colors.textPrimary,
    minHeight: 80,
    textAlignVertical: 'top',
    backgroundColor: colors.background,
  },
  ratingSubmitBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  ratingSubmitText: {
    color: colors.white,
    fontWeight: '700',
    fontSize: Typography.base,
  },
  // ── Bugün Yedim ────────────────────────────────────────────
  todayAteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: colors.secondary,
    marginBottom: Spacing.xl,
    paddingVertical: 14,
    borderRadius: Radius.xl,
    ...Shadow.sm,
  },
  todayAteBtnDone: { backgroundColor: colors.textMuted },
  todayAteBtnText: { color: colors.white, fontWeight: '700', fontSize: Typography.base },
});
