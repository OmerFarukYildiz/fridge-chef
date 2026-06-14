// ============================================================
// Fridge Chef — Alışveriş Listesi Ekranı
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
  RefreshControl,
  Animated,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import {
  getShoppingList,
  toggleShoppingItem,
  deleteShoppingItem,
  clearCheckedItems,
  addItemsToShoppingList,
} from '../../services/firestoreService';
import { ShoppingItem } from '../../types';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// ── Alışveriş Öğesi Bileşeni ─────────────────────────────────
interface ShoppingItemProps {
  item: ShoppingItem;
  onToggle: (id: string, checked: boolean) => void;
  onDelete: (id: string) => void;
}

function ShoppingItemRow({ item, onToggle, onDelete }: ShoppingItemProps) {
  const opacity = new Animated.Value(1);

  const handleDelete = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDelete(item.id));
  };

  return (
    <Animated.View style={[styles.itemRow, { opacity }]}>
      {/* Checkbox */}
      <TouchableOpacity
        style={[styles.checkbox, item.checked && styles.checkboxChecked]}
        onPress={() => onToggle(item.id, !item.checked)}
        activeOpacity={0.7}
      >
        {item.checked && (
          <Ionicons name="checkmark" size={14} color={Colors.white} />
        )}
      </TouchableOpacity>

      {/* İsim */}
      <Text style={[styles.itemName, item.checked && styles.itemNameChecked]}>
        {item.name}
      </Text>

      {/* Sil */}
      <TouchableOpacity
        style={styles.itemDeleteButton}
        onPress={handleDelete}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close-circle" size={20} color={Colors.textMuted} />
      </TouchableOpacity>
    </Animated.View>
  );
}

// ── Boş Durum ─────────────────────────────────────────────────
function EmptyShopping() {
  return (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="cart-outline" size={56} color={Colors.secondary} />
      </View>
      <Text style={styles.emptyTitle}>Alışveriş listeniz boş</Text>
      <Text style={styles.emptySubtitle}>
        Tarif oluştururken eksik malzemeleri tek tıkla buraya ekleyebilirsiniz
      </Text>
    </View>
  );
}

// ── Ana Ekran ─────────────────────────────────────────────────
export default function ShoppingScreen() {
  const { user } = useAuth();
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newItemText, setNewItemText] = useState('');
  const [addingItem, setAddingItem] = useState(false);

  // Sekmeye odaklanınca yenile
  useFocusEffect(
    useCallback(() => {
      loadItems();
    }, [user])
  );

  const loadItems = async () => {
    if (!user) return;
    try {
      const data = await getShoppingList(user.uid);
      setItems(data);
    } catch (err) {
      console.error('[Shopping]', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ── Toggle ────────────────────────────────────────────────
  const handleToggle = async (id: string, checked: boolean) => {
    if (!user) return;
    // Optimistic UI — önce state'i güncelle
    setItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, checked } : i))
    );
    await toggleShoppingItem(user.uid, id, checked);
  };

  // ── Tek Sil ───────────────────────────────────────────────
  const handleDelete = async (id: string) => {
    if (!user) return;
    setItems((prev) => prev.filter((i) => i.id !== id));
    await deleteShoppingItem(user.uid, id);
  };

  // ── Manuel Ürün Ekle ─────────────────────────────────────
  const handleAddItem = async () => {
    if (!newItemText.trim() || !user) return;
    setAddingItem(true);
    try {
      await addItemsToShoppingList(user.uid, [newItemText.trim()]);
      setNewItemText('');
      await loadItems();
    } finally {
      setAddingItem(false);
    }
  };

  // ── İşaretlenenleri Temizle ──────────────────────────────
  const handleClearChecked = () => {
    const checkedCount = items.filter((i) => i.checked).length;
    if (checkedCount === 0) return;

    Alert.alert(
      'İşaretlenenleri Temizle',
      `${checkedCount} işaretli ürün silinecek. Emin misiniz?`,
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Temizle',
          style: 'destructive',
          onPress: async () => {
            if (!user) return;
            await clearCheckedItems(user.uid);
            setItems((prev) => prev.filter((i) => !i.checked));
          },
        },
      ]
    );
  };

  // İstatistikler
  const totalCount = items.length;
  const checkedCount = items.filter((i) => i.checked).length;
  const uncheckedCount = totalCount - checkedCount;

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="cart" size={40} color={Colors.secondary} />
        <Text style={styles.loadingText}>Liste yükleniyor...</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <LinearGradient
        colors={[Colors.secondary, Colors.secondaryDark]}
        style={styles.header}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        <View style={styles.headerTop}>
          <View>
            <Text style={styles.headerTitle}>🛒 Alışveriş Listesi</Text>
            <Text style={styles.headerSubtitle}>
              {uncheckedCount} ürün kaldı · {checkedCount} tamamlandı
            </Text>
          </View>
          {/* İşaretlenenleri Temizle */}
          {checkedCount > 0 && (
            <TouchableOpacity
              style={styles.clearButton}
              onPress={handleClearChecked}
            >
              <Ionicons name="trash-outline" size={16} color={Colors.white} />
              <Text style={styles.clearButtonText}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* İlerleme çubuğu */}
        {totalCount > 0 && (
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${(checkedCount / totalCount) * 100}%` },
              ]}
            />
          </View>
        )}
      </LinearGradient>

      {/* Manuel Ürün Ekle Kutusu */}
      <View style={styles.addItemContainer}>
        <View style={styles.addItemInput}>
          <Ionicons name="add-circle-outline" size={20} color={Colors.textMuted} />
          <TextInput
            style={styles.addItemTextInput}
            placeholder="Ürün ekle..."
            placeholderTextColor={Colors.textMuted}
            value={newItemText}
            onChangeText={setNewItemText}
            onSubmitEditing={handleAddItem}
            returnKeyType="done"
          />
        </View>
        <TouchableOpacity
          style={[
            styles.addItemButton,
            (!newItemText.trim() || addingItem) && styles.addItemButtonDisabled,
          ]}
          onPress={handleAddItem}
          disabled={!newItemText.trim() || addingItem}
        >
          <Ionicons name="add" size={24} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Liste */}
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ShoppingItemRow
            item={item}
            onToggle={handleToggle}
            onDelete={handleDelete}
          />
        )}
        ListEmptyComponent={<EmptyShopping />}
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
            colors={[Colors.secondary]}
            tintColor={Colors.secondary}
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
    paddingBottom: 20,
    paddingHorizontal: Spacing.xl,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    gap: 12,
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
    color: 'rgba(255,255,255,0.85)',
    marginTop: 2,
  },
  clearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
  },
  clearButtonText: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: 3,
  },
  // ── Ürün Ekle ──────────────────────────────────────────────
  addItemContainer: {
    flexDirection: 'row',
    gap: 10,
    padding: Spacing.base,
    paddingTop: Spacing.base,
  },
  addItemInput: {
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
  addItemTextInput: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  addItemButton: {
    width: 48,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  addItemButtonDisabled: {
    opacity: 0.5,
  },
  // ── Liste ──────────────────────────────────────────────────
  listContent: {
    padding: Spacing.base,
    paddingTop: 4,
    gap: 8,
    paddingBottom: 24,
  },
  listContentEmpty: {
    flexGrow: 1,
  },
  // ── Öğe Satırı ─────────────────────────────────────────────
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.surface,
    padding: Spacing.base,
    borderRadius: Radius.md,
    ...Shadow.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  checkboxChecked: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  itemName: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
    fontWeight: '500',
  },
  itemNameChecked: {
    textDecorationLine: 'line-through',
    color: Colors.textMuted,
    fontWeight: '400',
  },
  itemDeleteButton: {
    padding: 2,
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
    backgroundColor: '#F0FFF4',
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
