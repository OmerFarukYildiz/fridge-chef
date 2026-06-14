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
import { useAuth } from '../../context/AuthContext';
import {
  getPantryItems,
  deleteFromPantry,
  updatePantryItemExpiry,
  addItemsToPantry,
  getExpiringSoonItems,
} from '../../services/firestoreService';
import { getZeroWasteRecipeFromPantry } from '../../services/geminiService';
import {
  PantryItem,
  getExpiryLabel,
  getExpiryStatus,
} from '../../types';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';

// ── STT Seçici Modal ─────────────────────────────────────────
interface ExpiryPickerModalProps {
  visible: boolean;
  itemName: string;
  currentExpiry: number | null;
  onConfirm: (date: number | null) => void;
  onClose: () => void;
}

function ExpiryPickerModal({
  visible,
  itemName,
  currentExpiry,
  onConfirm,
  onClose,
}: ExpiryPickerModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(
    currentExpiry ? new Date(currentExpiry) : new Date()
  );

  const handleChange = (_: DateTimePickerEvent, date?: Date) => {
    if (date) setSelectedDate(date);
    // Android'de picker otomatik kapanır, iOS'ta kapanmaz
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
            textColor={Colors.textPrimary}
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
              <Ionicons name="trash-outline" size={16} color={Colors.error} />
              <Text style={[pickerStyles.cancelBtnText, { color: Colors.error }]}>
                Tarihi Temizle
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const pickerStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    ...Shadow.lg,
  },
  header: {
    padding: Spacing.xl,
    paddingBottom: Spacing.base,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
  subtitle: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 4 },
  picker: { height: 200 },
  iosButtons: {
    flexDirection: 'row',
    padding: Spacing.base,
    gap: 8,
  },
  cancelBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.border,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  clearBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    borderWidth: 1, borderColor: Colors.error,
    alignItems: 'center',
  },
  clearBtnText: { fontSize: Typography.base, color: Colors.error, fontWeight: '600' },
  confirmBtn: {
    flex: 1, paddingVertical: 12, borderRadius: Radius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  confirmBtnText: { fontSize: Typography.base, color: Colors.white, fontWeight: '700' },
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
}

function PantryCard({ item, onSetExpiry, onDelete }: PantryCardProps) {
  const { label, color, bgColor } = getExpiryLabel(item.expiryDate);
  const status = getExpiryStatus(item.expiryDate);
  const isUrgent = status === 'expired' || status === 'today' || status === 'expiring_soon';

  return (
    <View style={[cardStyles.card, isUrgent && cardStyles.cardUrgent]}>
      {/* Sol Aksan Çizgisi */}
      <View style={[cardStyles.accent, { backgroundColor: color }]} />

      <View style={cardStyles.content}>
        {/* İsim */}
        <Text style={cardStyles.name}>{item.name}</Text>

        {/* STT Badge */}
        <TouchableOpacity
          style={[cardStyles.badge, { backgroundColor: bgColor }]}
          onPress={() => onSetExpiry(item)}
        >
          <Text style={[cardStyles.badgeText, { color }]}>{label}</Text>
          <Ionicons name="pencil" size={11} color={color} />
        </TouchableOpacity>
      </View>

      {/* Sil Butonu */}
      <TouchableOpacity
        style={cardStyles.deleteBtn}
        onPress={() => onDelete(item)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
      </TouchableOpacity>
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
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
  name: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
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

// ── Ana Ekran ─────────────────────────────────────────────────
export default function PantryScreen() {
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const [items, setItems] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [zeroWasteLoading, setZeroWasteLoading] = useState(false);

  // Manuel ekleme
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // STT picker
  const [pickerVisible, setPickerVisible] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<PantryItem | null>(null);

  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [user])
  );

  const loadItems = async () => {
    if (!user) return;
    try {
      const data = await getPantryItems(user.uid);
      setItems(data);
    } catch (err) {
      console.error('[Pantry]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── STT Güncelle ─────────────────────────────────────────────
  const handleSetExpiry = (item: PantryItem) => {
    setPickerTarget(item);
    setPickerVisible(true);
  };

  const handleExpiryConfirm = async (date: number | null) => {
    setPickerVisible(false);
    if (!user || !pickerTarget) return;

    await updatePantryItemExpiry(user.uid, pickerTarget.id, date);
    setItems((prev) =>
      prev.map((i) => (i.id === pickerTarget.id ? { ...i, expiryDate: date } : i))
    );
    setPickerTarget(null);
  };

  // ── Sil ──────────────────────────────────────────────────────
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
            await deleteFromPantry(user.uid, item.id);
            setItems((prev) => prev.filter((i) => i.id !== item.id));
          },
        },
      ]
    );
  };

  // ── Manuel Ekle ──────────────────────────────────────────────
  const handleAddItem = async () => {
    if (!newItemText.trim() || !user) return;
    setAddingItem(true);
    try {
      const added = await addItemsToPantry(user.uid, [newItemText.trim()]);
      setNewItemText('');
      if (added === 0) {
        Alert.alert('Zaten Kilerde', `"${newItemText.trim()}" zaten kilerinizde mevcut.`);
      }
      await loadItems();
    } finally {
      setAddingItem(false);
    }
  };

  // ── Sıfır Atık Tarifi ─────────────────────────────────────────
  const handleZeroWaste = async () => {
    if (!user) return;
    setZeroWasteLoading(true);

    try {
      const expiring = await getExpiringSoonItems(user.uid, 3);
      const all = await getPantryItems(user.uid);

      if (all.length === 0) {
        Alert.alert('Kiler Boş', 'Önce kilerinize malzeme eklemelisiniz.');
        return;
      }

      const expiringNames = expiring.map((i) => i.name);
      const allNames = all.map((i) => i.name);

      const recipe = await getZeroWasteRecipeFromPantry(
        expiringNames,
        allNames,
        userProfile?.preferences
      );

      // Tarif ekranına JSON olarak geç
      router.push({
        pathname: '/recipe',
        params: {
          fromFavorite: 'true',
          recipeJson: JSON.stringify(recipe),
        },
      });
    } catch (err) {
      Alert.alert('Hata', 'Sıfır Atık tarifi oluşturulamadı. Lütfen tekrar deneyin.');
      console.error('[ZeroWaste]', err);
    } finally {
      setZeroWasteLoading(false);
    }
  };

  // ── İstatistikler ─────────────────────────────────────────────
  const expiringSoon = items.filter((i) => {
    const s = getExpiryStatus(i.expiryDate);
    return s === 'expired' || s === 'today' || s === 'expiring_soon';
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="file-tray-full-outline" size={40} color={Colors.primary} />
        <Text style={styles.loadingText}>Kiler yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* ── Header ─────────────────────────────────────────── */}
      <LinearGradient
        colors={['#1A1A2E', '#16213E']}
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

        {/* Sıfır Atık Banner — sadece yaklaşan STT varsa göster */}
        {expiringSoon.length > 0 && (
          <TouchableOpacity
            style={styles.zeroWasteBanner}
            onPress={handleZeroWaste}
            disabled={zeroWasteLoading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={[Colors.gradientStart, Colors.gradientEnd]}
              style={styles.zeroWasteBannerGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
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
            </LinearGradient>
          </TouchableOpacity>
        )}
      </LinearGradient>

      {/* ── Manuel Ekle ────────────────────────────────────── */}
      <View style={styles.addRow}>
        <View style={styles.addInput}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.addTextInput}
            placeholder="Malzeme ekle..."
            placeholderTextColor={Colors.textMuted}
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
            maxLength={50}
          />
        </View>
        <TouchableOpacity
          style={[
            styles.addButton,
            (!newItemText.trim() || addingItem) && styles.addButtonDisabled,
          ]}
          onPress={handleAddItem}
          disabled={!newItemText.trim() || addingItem}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* ── STT Açıklaması ─────────────────────────────────── */}
      <Text style={styles.hintText}>
        💡 Her malzeme kartına dokunarak Son Tüketim Tarihi (STT) ekleyebilirsin
      </Text>

      {/* ── Liste ──────────────────────────────────────────── */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PantryCard
            item={item}
            onSetExpiry={handleSetExpiry}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="file-tray-outline" size={52} color={Colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>Kileriniz boş</Text>
            <Text style={styles.emptySubtitle}>
              Tarif oluşturduktan sonra malzemeleri buraya kaydedebilirsiniz.{'\n'}
              Ya da yukarıdan manuel ekleyebilirsiniz.
            </Text>
          </View>
        }
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              loadItems();
            }}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
      />

      {/* ── STT Picker Modal ───────────────────────────────── */}
      {pickerTarget && (
        <ExpiryPickerModal
          visible={pickerVisible}
          itemName={pickerTarget.name}
          currentExpiry={pickerTarget.expiryDate}
          onConfirm={handleExpiryConfirm}
          onClose={() => {
            setPickerVisible(false);
            setPickerTarget(null);
          }}
        />
      )}
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
    color: Colors.white,
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
  zeroWasteBannerIcon: { fontSize: 28 },
  zeroWasteBannerText: { flex: 1 },
  zeroWasteBannerTitle: {
    fontSize: Typography.base,
    fontWeight: '800',
    color: Colors.white,
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
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1.5,
    borderColor: Colors.border,
    ...Shadow.sm,
  },
  addTextInput: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  addButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  addButtonDisabled: { opacity: 0.5 },
  // ── İpucu ──────────────────────────────────────────────────
  hintText: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
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
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
});
