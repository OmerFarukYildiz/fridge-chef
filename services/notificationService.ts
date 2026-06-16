// ============================================================
// Fridge Chef — Bildirim Servisi (expo-notifications)
// ============================================================
// Özellikler:
//  • Cihaz bazlı bildirim izni isteme (uygulama ilk açılışta)
//  • Kiler son kullanma tarihi kontrolü (sabah 09:00)
//  • Push notification şablonları
// ============================================================

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ── Bildirim Davranışı ────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// ── Bildirim İzni İste ────────────────────────────────────────
export const requestNotificationPermission = async (): Promise<boolean> => {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    if (existingStatus === 'granted') return true;

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;

    // Android için kanal oluştur
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('kiler', {
        name: 'Kiler Bildirimleri',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF8C00',
      });
    }

    return true;
  } catch (err) {
    console.error('[Notifications] İzin hatası:', err);
    return false;
  }
};

// ── Kiler Uyarı Bildirimi Gönder ────────────────────────────
export const sendExpiryNotification = async (
  itemNames: string[]
): Promise<void> => {
  if (itemNames.length === 0) return;

  const title = itemNames.length === 1
    ? `⚠️ ${itemNames[0]} bozulmak üzere!`
    : `⚠️ ${itemNames.length} ürün bozulmak üzere!`;

  const body = itemNames.length === 1
    ? `${itemNames[0]} son kullanma tarihi 1-3 gün içinde dolacak. Hemen tarif oluştur!`
    : `${itemNames.slice(0, 2).join(', ')}${itemNames.length > 2 ? ` ve ${itemNames.length - 2} ürün daha` : ''} bozulmak üzere. Fridge Chef'i aç!`;

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: { type: 'expiry' },
    },
    trigger: null, // Anında gönder
  });
};

// ── Sabah 09:00 Günlük Kiler Kontrolü Planla ────────────────
export const scheduleDailyPantryCheck = async (): Promise<void> => {
  // Mevcut planlanmış bildirimleri temizle
  await Notifications.cancelAllScheduledNotificationsAsync();

  await Notifications.scheduleNotificationAsync({
    content: {
      title: '🍽️ Fridge Chef — Kiler Kontrolü',
      body: 'Kilerdeki malzemelerin son kullanma tarihlerini kontrol et!',
      sound: true,
      data: { type: 'daily_check' },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: 9,
      minute: 0,
    },
  });
};

// ── Tüm Bildirimleri İptal Et ────────────────────────────────
export const cancelAllNotifications = async (): Promise<void> => {
  await Notifications.cancelAllScheduledNotificationsAsync();
};
