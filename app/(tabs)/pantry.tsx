// ============================================================
// Fridge Chef — Sanal Kiler Ekranı
// ============================================================
// Özellikler:
//  • Gemini ile tespit edilen malzemeleri listeler
//  • Her malzeme için STT (Son Tüketim Tarihi) girişi
//  • Renk kodlu STT badge'leri (yeşil/sarı/kırmızı)
//  • Bozulmak üzere olan malzemeler için uyarı banner
//  • "Sıfır Atık Tarifi Oluştur" butonu
//  • Manuel malzeme ekleme
// ============================================================

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Platform,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { LinearGradient } from 'expo-linear-gradient';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useAuth } from '../../context/AuthContext';
import {
  addItemsToPantry,
  deleteFromPantry,
  getPantryItems,
  getExpiringSoonItems,
  updatePantryItemExpiry,
  getLeftovers,
  deleteLeftover,
} from '../../services/firestoreService';
import { getZeroWasteRecipeFromPantry, getLeftoverRecipes, extractFoodItemsFromReceipt } from '../../services/geminiService';
import { ExpiryStatus, PantryItem, getExpiryStatus, getExpiryLabel, LeftoverItem } from '../../types';
import { AppThemeColors, Typography, Spacing, Radius, Shadow } from '../../constants/Colors';
import { useTheme } from '../../context/ThemeContext';

// ── STT Seçici Modal ─────────────────────────────────────────
interface ExpiryPickerModalProps {
  visible: boolean;
  itemName: string;
  currentExpiry: number | null;
  onConfirm: (date: number | null) => void;
  onClose: () => void;
  colors: AppThemeColors;
}

function ExpiryPickerModal({
  visible,
  itemName,
  currentExpiry,
  onConfirm,
  onClose,
  colors,
}: ExpiryPickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(
    currentExpiry ? new Date(currentExpiry) : new Date()
  );
  const pickerStyles = getPickerStyles(colors);

  const handleChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setSelectedDate(date);
    if (Platform.OS === 'android') onConfirm(date ? date.getTime() : null);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={pickerStyles.overlay}>
        <View style={pickerStyles.sheet}>
          <View style={pickerStyles.header}>
            <Text style={pickerStyles.title}>Son Tüketim Tarihi</Text>
            <Text style={pickerStyles.subtitle} numberOfLines={1}>
              📦 {itemName}
            </Text>
          </View>

          <DateTimePicker
            value={selectedDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleChange}
            minimumDate={new Date()}
            locale="tr-TR"
            style={pickerStyles.picker}
            themeVariant="light"
            textColor={colors.textPrimary}
          />

          {Platform.OS === 'ios' && (
            <View style={pickerStyles.iosButtons}>
              <TouchableOpacity style={pickerStyles.cancelBtn} onPress={onClose}>
                <Text style={pickerStyles.cancelBtnText}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={pickerStyles.clearBtn}
                onPress={() => onConfirm(null)}
              >
                <Text style={pickerStyles.clearBtnText}>Tarihi Temizle</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={pickerStyles.confirmBtn}
                onPress={() => onConfirm(selectedDate.getTime())}
              >
                <Text style={pickerStyles.confirmBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          )}

          {Platform.OS === 'android' && (
            <TouchableOpacity style={pickerStyles.clearBtnAndroid} onPress={() => onConfirm(null)}>
              <Ionicons name="trash-outline" size={16} color={colors.error} />
              <Text style={[pickerStyles.cancelBtnText, { color: colors.error }]}>
                Tarihi Temizle
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const getPickerStyles = (colors: AppThemeColors) => StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Shadow.lg,
  },
  header: {
    padding: Spacing.xl,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontSize: Typography.xl, fontWeight: '800', color: colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: colors.textSecondary, marginTop: 4 },
  picker: { height: 200 },
  iosButtons: {
    flexDirection: 'row',
    padding: Spacing.base,
    gap: 8,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: Typography.base, color: colors.textSecondary, fontWeight: '600' },
  clearBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: colors.error,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: Typography.base, color: colors.error, fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: colors.primary, alignItems: 'center',
  },
  confirmBtnText: { fontSize: Typography.base, color: colors.white, fontWeight: '700' },
  clearBtnAndroid: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    padding: Spacing.base,
    marginTop: 4,
  },
});

// ── Kiler Öğesi Kartı ─────────────────────────────────────────
interface PantryCardProps {
  item: PantryItem;
  onSetExpiry: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
  colors: AppThemeColors;
}

function PantryCard({ item, onSetExpiry, onDelete, colors }: PantryCardProps) {
  const { label, color, bgColor } = getExpiryLabel(item.expiryDate);
  const status = getExpiryStatus(item.expiryDate);
  const isUrgent = status === 'expired' || status === 'today' || status === 'expiring_soon';
  const cardStyles = getCardStyles(colors);

  return (
    <View style={[cardStyles.card, isUrgent && cardStyles.cardUrgent]}>
      <View style={[cardStyles.accent, { backgroundColor: color }]} />
      <View style={cardStyles.content}>
        <Text style={cardStyles.name}>{item.name}</Text>
        <TouchableOpacity
          style={[cardStyles.badge, { backgroundColor: bgColor }]}
          onPress={() => onSetExpiry(item)}
        >
          <Text style={[cardStyles.badgeText, { color }]}>{label}</Text>
          <Ionicons name="pencil" size={11} color={color} />
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={cardStyles.deleteBtn}
        onPress={() => onDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={22} color={colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const getCardStyles = (colors: AppThemeColors) => StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardUrgent: {
    borderWidth: 1,
    borderColor: '#FBBF24',
  },
  accent: { width: 4, alignSelf: 'stretch' },
  content: { flex: 1, padding: 12, gap: 6 },
  name: { fontSize: Typography.base, fontWeight: '600', color: colors.textPrimary },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Radius.full,
  },
  badgeText: { fontSize: 12, fontWeight: '700' },
  deleteBtn: { paddingRight: 12, padding: 4 },
});

const BARCODE_LOOKUP_PROMPT = (barcode: string) =>
  `Bir barkod tarama sistemisin. Barkod: "${barcode}". Bu barkodun ait olduğu yaygın ürünün Türkçe kısa adını yaz (sadece isim, maksimum 3 kelime). Bilmiyorsan "bilinmeyen ürün" yaz.`;

export default function PantryScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const cardStyles = React.useMemo(() => getCardStyles(colors), [colors]);

  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [items, setItems] = useState<PantryItem[]>([]);
  const [leftovers, setLeftovers] = useState<LeftoverItem[]>([]);
  const [activeTab, setActiveTab] = useState<'pantry' | 'leftovers'>('pantry');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zeroWasteLoading, setZeroWasteLoading] = useState(false);
  const [leftoverLoading, setLeftoverLoading] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);
  const [receiptScanning, setReceiptScanning] = useState(false);
  const [barcodeVisible, setBarcodeVisible] = useState(false);
  const [barcodeScanning, setBarcodeScanning] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PantryItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [user, userProfile?.familyId])
  );

  const loadItems = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const targetId = userProfile?.familyId || user.uid;
      const data = await getPantryItems(targetId);
      setItems(data);
      const leftoverData = await getLeftovers(targetId);
      setLeftovers(leftoverData);
    } catch (err) {
      console.error('[Pantry]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSetExpiry = (item: PantryItem) => {
    setPickerTarget(item);
    setPickerVisible(true);
  };

  const handleExpiryConfirm = async (date: number | null) => {
    setPickerVisible(false);
    if (!user || !pickerTarget) return;

    const targetId = userProfile?.familyId || user.uid;
    await updatePantryItemExpiry(targetId, pickerTarget.id, date);
    setItems((prev) =>
      prev.map((i) => (i.id === pickerTarget.id ? { ...i, expiryDate: date } : i))
    );
    setPickerTarget(null);
  };

  const handleDelete = (item: PantryItem) => {
    Alert.alert(
      'Kilerden Kaldır',
      `"${item.name}" kilerden kaldırılsın mı?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            const targetId = userProfile?.familyId || user.uid;
            await deleteFromPantry(targetId, item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          },
        },
      ]
    );
  };

  const handleDeleteLeftover = (item: LeftoverItem) => {
    Alert.alert('Sil', `"${item.name}" silinsin mi?`, [
      { text: 'İptal', style: 'cancel' },
      {
        text: 'Sil', style: 'destructive', onPress: async () => {
          if (!user) return;
          const targetId = userProfile?.familyId || user.uid;
          await deleteLeftover(targetId, item.id);
          setLeftovers((prev) => prev.filter((i) => i.id !== item.id));
        }
      },
    ]);
  };

  const handleAddItem = async () => {
    if (!newItemText.trim() || !user) return;
    setAddingItem(true);
    try {
      const targetId = userProfile?.familyId || user.uid;
      const added = await addItemsToPantry(targetId, [newItemText.trim()]);
      setNewItemText('');
      if (added === 0) {
        Alert.alert('Zaten Kilerde', `"${newItemText.trim()}" zaten kilerinizde mevcut.`);
      }
      await loadItems();
    } finally {
      setAddingItem(false);
    }
  };

  const openBarcodeScanner = async () => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Kamera İzni Gerekli', 'Barkod taramak için kamera iznine ihtiyaç var.');
        return;
      }
    }
    setBarcodeVisible(true);
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (barcodeScanning || !user) return;
    setBarcodeScanning(true);
    try {
      let productName = '';

      // 1. Önce Open Food Facts API ile gerçek ürünü sorgula
      try {
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${data}.json`);
        const offData = await response.json();
        if (offData.status === 1 && offData.product) {
          const p = offData.product;
          productName = p.product_name_tr || p.product_name || p.generic_name || p.brands || '';
        }
      } catch (e) {
        console.error('[Barcode] OpenFoodFacts error:', e);
      }

      // 2. Open Food Facts'te bulunamazsa Gemini ile tahmin et
      if (!productName || productName.trim() === '') {
        const { GoogleGenAI } = await import('@google/genai');
        const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) throw new Error('API Key yok');
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: process.env.EXPO_PUBLIC_GEMINI_MODEL || process.env.GEMINI_MODEL || 'gemini-2.0-flash',
          contents: [{ role: 'user', parts: [{ text: BARCODE_LOOKUP_PROMPT(data) }] }],
          config: { temperature: 0.1 },
        });
        productName = (res.text ?? '').trim() || 'Bilinmeyen Ürün';
      }

      setBarcodeVisible(false);
      Alert.alert(
        '📦 Ürün Tespit Edildi',
        `"${productName}" kilere eklensin mi?`,
        [
          { text: 'Hayır', style: 'cancel', onPress: () => setBarcodeScanning(false) },
          {
            text: 'Evet, Ekle',
            onPress: async () => {
              const targetId = userProfile?.familyId || user.uid;
              await addItemsToPantry(targetId, [productName]);
              await loadItems();
              setBarcodeScanning(false);
            },
          },
        ]
      );
    } catch (err) {
      setBarcodeScanning(false);
      console.error('[Barcode] Scan error:', err);
      Alert.alert('Hata', 'Barkod okunamadı. Tekrar deneyin.');
    }
  };

  const handleReceiptScan = async () => {
    try {
      // Kamera iznini iste
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('İzin Gerekli', 'Fiş taramak için kamera iznine ihtiyacımız var.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 1,
      });
      if (!result.canceled && result.assets.length > 0) {
        setReceiptScanning(true);
        const manipResult = await ImageManipulator.manipulateAsync(
          result.assets[0].uri,
          [{ resize: { width: 800 } }],
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        if (!manipResult.base64) throw new Error('Resim işlenemedi');

        const extractedItems = await extractFoodItemsFromReceipt(manipResult.base64);

        if (extractedItems.length === 0) {
          Alert.alert('Uyarı', 'Fişten gıda ürünü çıkarılamadı veya fiş okunamadı.');
        } else {
          Alert.alert(
            'Fiş Tarandı',
            `Şu ürünler bulundu:\n${extractedItems.join(', ')}\n\nKilere eklensin mi?`,
            [
              { text: 'İptal', style: 'cancel' },
              {
                text: 'Ekle', onPress: async () => {
                  if (!user) return;
                  const targetId = userProfile?.familyId || user.uid;
                  await addItemsToPantry(targetId, extractedItems);
                  await loadItems();
                }
              }
            ]
          );
        }
      }
    } catch (err: any) {
      console.error('[ReceiptScan] error:', err);
      Alert.alert('Hata', `Fiş tarama başarısız oldu: ${err?.message || err}`);
    } finally {
      setReceiptScanning(false);
    }
  };

  const handleZeroWaste = async () => {
    if (!user) return;
    setZeroWasteLoading(true);

    try {
      const targetId = userProfile?.familyId || user.uid;
      const expiring = await getExpiringSoonItems(targetId, 3);
      const all = await getPantryItems(targetId);
      if (all.length === 0) {
        Alert.alert('Kiler Boş', 'Önce kilerinize malzeme eklemelisiniz.');
        return;
      }
      const expiringNames = expiring.map((i) => i.name);
      const allNames = all.map((i) => i.name);
      const recipe = await getZeroWasteRecipeFromPantry(expiringNames, allNames, userProfile ?? undefined);
      router.push({
        pathname: '/recipe',
        params: { fromFavorite: 'true', recipeJson: JSON.stringify(recipe) },
      });
    } catch (err) {
      Alert.alert('Hata', 'Sıfır Atık tarifi oluşturulamadı. Lütfen tekrar deneyin.');
      console.error('[ZeroWaste]', err);
    } finally {
      setZeroWasteLoading(false);
    }
  };

  const handleLeftoverMagic = async () => {
    if (!user || leftovers.length === 0) return;
    setLeftoverLoading(true);
    try {
      const leftoversList = leftovers.map((l) => `${l.name} (${l.portion})`);
      const pantryList = items.map((i) => i.name);
      const options = await getLeftoverRecipes(leftoversList, pantryList, userProfile ?? undefined);
      router.push({
        pathname: '/recipe-picker' as any,
        params: {
          optionsJson: JSON.stringify(options),
          identifiedItems: leftoversList.join(', '),
        },
      });
    } catch (err) {
      Alert.alert('Hata', 'Artık yemek değerlendirme başarısız oldu.');
    } finally {
      setLeftoverLoading(false);
    }
  };

  const expiringSoon = items.filter((i) => {
    const s = getExpiryStatus(i.expiryDate);
    return s === 'expired' || s === 'today' || s === 'expiring_soon';
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="file-tray-full-outline" size={40} color={colors.primary} />
        <Text style={styles.loadingText}>Kiler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient
        colors={['#3B82F6', '#2563EB']}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>📦 Sanal Kilerim</Text>
            <Text style={styles.headerSubtitle}>
              {items.length} malzeme
              {expiringSoon.length > 0 ? ` · ⚠️ ${expiringSoon.length} ürün dikkat` : ''}
            </Text>
          </View>
        </View>

        {expiringSoon.length > 0 && (
          <TouchableOpacity
            style={styles.zeroWasteBanner}
            onPress={handleZeroWaste}
            disabled={zeroWasteLoading}
            activeOpacity={0.85}
          >
            <View style={styles.zeroWasteBannerInner}>
              {zeroWasteLoading ? (
                <ActivityIndicator size="small" color="white" />
              ) : (
                <Text style={styles.zeroWasteBannerIcon}>♻️</Text>
              )}
              <View style={styles.zeroWasteBannerText}>
                <Text style={styles.zeroWasteBannerTitle}>
                  {zeroWasteLoading ? 'Tarif Oluşturuluyor...' : 'Sıfır Atık Tarifi Oluştur'}
                </Text>
                <Text style={styles.zeroWasteBannerSubtitle}>
                  {expiringSoon.length} malzeme bozulmak üzere — hepsini kullan!
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="rgba(255,255,255,0.8)" />
            </View>
          </TouchableOpacity>
        )}
      </LinearGradient>

      <View style={styles.tabContainer}>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'pantry' && styles.tabBtnActive]} onPress={() => setActiveTab('pantry')}>
          <Text style={[styles.tabBtnText, activeTab === 'pantry' && styles.tabBtnTextActive]}>Kiler</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabBtn, activeTab === 'leftovers' && styles.tabBtnActive]} onPress={() => setActiveTab('leftovers')}>
          <Text style={[styles.tabBtnText, activeTab === 'leftovers' && styles.tabBtnTextActive]}>Artan Yemekler</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'pantry' ? (
        <>
          <View style={styles.addRow}>
            <View style={styles.addInput}>
              <Ionicons name="add-circle-outline" size={20} color={colors.textMuted} />
              <TextInput
                style={styles.addTextInput}
                placeholder="Malzeme ekle..."
                placeholderTextColor={colors.textMuted}
                value={newItemText}
                onChangeText={setNewItemText}
                onSubmitEditing={handleAddItem}
                returnKeyType="done"
                maxLength={50}
              />
            </View>
            <TouchableOpacity
              style={[styles.addButton, (!newItemText.trim() || addingItem) && styles.addButtonDisabled]}
              onPress={handleAddItem}
              disabled={!newItemText.trim() || addingItem}
            >
              <Ionicons name="add" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.barcodeBtn} onPress={openBarcodeScanner}>
              <Ionicons name="barcode-outline" size={24} color={colors.white} />
            </TouchableOpacity>
            <TouchableOpacity style={[styles.barcodeBtn, receiptScanning && styles.addButtonDisabled]} onPress={handleReceiptScan} disabled={receiptScanning}>
              {receiptScanning ? <ActivityIndicator size="small" color="white" /> : <Ionicons name="receipt-outline" size={24} color={colors.white} />}
            </TouchableOpacity>
          </View>

          <Text style={styles.hintText}>
            💡 Her malzeme kartına dokunarak Son Tüketim Tarihi (STT) ekleyebilirsin
          </Text>

          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <PantryCard
                item={item}
                onSetExpiry={handleSetExpiry}
                onDelete={handleDelete}
                colors={colors}
              />
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <View style={styles.emptyIconCircle}>
                  <Ionicons name="file-tray-outline" size={52} color={colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>Kileriniz boş</Text>
                <Text style={styles.emptySubtitle}>
                  Tarif oluşturduktan sonra malzemeleri buraya kaydedebilirsiniz.{'\n'}
                  Ya da yukarıdan manuel ekleyebilirsiniz.
                </Text>
              </View>
            }
            contentContainerStyle={[styles.listContent, items.length === 0 && styles.listContentEmpty]}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => { setRefreshing(true); loadItems(); }}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
          />
        </>
      ) : (
        <View style={{ flex: 1 }}>
          <View style={{ padding: Spacing.xl, paddingBottom: 0 }}>
            <TouchableOpacity
              style={[styles.zeroWasteBanner, leftovers.length === 0 && { opacity: 0.5 }]}
              onPress={handleLeftoverMagic}
              disabled={leftovers.length === 0 || leftoverLoading}
            >
              <View style={[styles.zeroWasteBannerInner, { backgroundColor: '#D97706' }]}>
                <Text style={styles.zeroWasteBannerIcon}>🪄</Text>
                <View style={styles.zeroWasteBannerText}>
                  <Text style={styles.zeroWasteBannerTitle}>
                    {leftoverLoading ? 'Oluşturuluyor...' : 'Artıkları Değerlendir'}
                  </Text>
                  <Text style={styles.zeroWasteBannerSubtitle}>Yepyeni bir tarife dönüştür</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color="white" />
              </View>
            </TouchableOpacity>
          </View>
          <FlatList
            data={leftovers}
            keyExtractor={(l) => l.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={[cardStyles.card, { marginBottom: Spacing.sm }]}>
                <View style={[cardStyles.accent, { backgroundColor: '#D97706' }]} />
                <View style={cardStyles.content}>
                  <Text style={cardStyles.name}>{item.name}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>{item.portion}</Text>
                  <Text style={{ fontSize: 10, color: colors.textMuted }}>{new Date(item.addedAt).toLocaleDateString('tr-TR')}</Text>
                </View>
                <TouchableOpacity style={cardStyles.deleteBtn} onPress={() => handleDeleteLeftover(item)}>
                  <Ionicons name="close-circle" size={22} color={colors.textMuted} />
                </TouchableOpacity>
              </View>
            )}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>Artan yemek yok</Text>
              </View>
            }
          />
        </View>
      )}

      {pickerTarget && (
        <ExpiryPickerModal
          visible={pickerVisible}
          itemName={pickerTarget.name}
          currentExpiry={pickerTarget.expiryDate}
          onConfirm={handleExpiryConfirm}
          onClose={() => { setPickerVisible(false); setPickerTarget(null); }}
          colors={colors}
        />
      )}

      <Modal visible={barcodeVisible} animationType="slide" onRequestClose={() => setBarcodeVisible(false)}>
        <View style={styles.barcodeModal}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }}
            onBarcodeScanned={barcodeScanning ? undefined : handleBarcodeScanned}
          />
          <View style={styles.barcodeOverlay}>
            <Text style={styles.barcodeTitle}>📦 Barkod Tarat</Text>
            <Text style={styles.barcodeSub}>Barkodu çerçeveye hizala</Text>
          </View>
          <View style={styles.barcodeTarget} />
          {barcodeScanning && (
            <ActivityIndicator size="large" color={colors.primary} style={styles.barcodeSpinner} />
          )}
          <TouchableOpacity
            style={styles.barcodeClose}
            onPress={() => { setBarcodeVisible(false); setBarcodeScanning(false); }}
          >
            <Ionicons name="close-circle" size={44} color="white" />
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = (colors: AppThemeColors) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: Spacing.xl,
    gap: 14,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: Typography['2xl'],
    fontWeight: '800',
    color: colors.white,
  },
  headerSubtitle: {
    fontSize: Typography.sm,
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
  },
  // ── Sıfır Atık Banner ──────────────────────────────────────
  zeroWasteBanner: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...Shadow.md,
  },
  zeroWasteBannerGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    gap: 12,
  },
  zeroWasteBannerInner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.base,
    gap: 14,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  zeroWasteBannerIcon: { fontSize: 28 },
  zeroWasteBannerText: {
    flex: 1,
    gap: 2,
  },
  zeroWasteBannerTitle: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: colors.white,
  },
  zeroWasteBannerSubtitle: {
    fontSize: Typography.xs,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  // ── Manuel Ekle ────────────────────────────────────────────
  addRow: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.base,
  },
  addInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1.5,
    borderColor: colors.border,
    ...Shadow.sm,
  },
  addTextInput: {
    flex: 1,
    fontSize: Typography.base,
    color: colors.textPrimary,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  addButtonDisabled: { opacity: 0.5 },
  barcodeBtn: {
    width: 48, height: 48, borderRadius: Radius.md,
    backgroundColor: '#6B7280',
    justifyContent: 'center', alignItems: 'center',
    ...Shadow.sm,
  },
  // ── İpucu ──────────────────────────────────────────────────
  hintText: {
    fontSize: Typography.xs,
    color: colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.xl,
    paddingBottom: 4,
  },
  // ── Liste ──────────────────────────────────────────────────
  listContent: {
    padding: Spacing.base,
    paddingTop: 8,
    gap: 8,
    paddingBottom: 30,
  },
  listContentEmpty: { flexGrow: 1 },
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
    fontWeight: '500',
  },
  // ── Tabs ───────────────────────────────────────────────────
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.base,
    gap: 12,
  },
  tabBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: Radius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabBtnText: {
    fontSize: Typography.sm,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  tabBtnTextActive: {
    color: colors.white,
  },
  // ── Boş Durum ──────────────────────────────────────────────
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing['2xl'],
    gap: 16,
    marginTop: 60,
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
  // ── Barkod Modal ───────────────────────────────────────────────
  barcodeModal: { flex: 1, backgroundColor: 'black', justifyContent: 'center', alignItems: 'center' },
  barcodeOverlay: {
    position: 'absolute', top: 60, left: 0, right: 0,
    alignItems: 'center', gap: 8,
  },
  barcodeTitle: { color: 'white', fontSize: 22, fontWeight: '800' },
  barcodeSub: { color: 'rgba(255,255,255,0.7)', fontSize: 14 },
  barcodeTarget: {
    width: 240, height: 160, borderWidth: 3, borderColor: colors.primary,
    borderRadius: 12, backgroundColor: 'transparent',
  },
  barcodeSpinner: { position: 'absolute', bottom: 160 },
  barcodeClose: { position: 'absolute', bottom: 60 },
});
