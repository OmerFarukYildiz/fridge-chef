// ============================================================
// Fridge Chef — Root Layout
// ============================================================
// AuthProvider tüm uygulamayı sarar.
// Auth durumuna göre (auth) veya (tabs) grubuna yönlendirir.
// ============================================================

import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LogBox } from 'react-native';

LogBox.ignoreLogs(['expo-notifications: Android Push notifications']);
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { requestNotificationPermission } from '../services/notificationService';

// ── Auth'a Göre Yönlendiren İç Bileşen ───────────────────────
function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = (segments as string[])[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login' as any);
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)' as any);
    }

    // Kullanıcı giriş yaptığında bildirim izni iste
    if (user && !inAuthGroup) {
      requestNotificationPermission().catch(() => {});
    }
  }, [user, loading, segments]);

  // İlk auth kontrolü yapılırken splash göster
  if (loading) {
    return (
      <View
        style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background }}
      >
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      {/* Auth Ekranları Grubu */}
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />

      {/* Tab Ekranları Grubu */}
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />

      {/* Kamera (Modal) */}
      <Stack.Screen
        name="camera"
        options={{ headerShown: false, presentation: 'fullScreenModal' }}
      />

      {/* Tarif Sayfası */}
      <Stack.Screen
        name="recipe"
        options={{
          headerShown: true,
          title: 'Tarifiniz',
          headerBackTitle: 'Geri',
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
        }}
      />

      {/* Profil Sayfası */}
      <Stack.Screen
        name="profile"
        options={{
          headerShown: true,
          title: 'Profilim',
          headerBackTitle: 'Geri',
          headerTintColor: Colors.primary,
          headerStyle: { backgroundColor: Colors.background },
          headerShadowVisible: false,
        }}
      />
    </Stack>
  );
}

// ── Root Layout ──────────────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider>
        <AuthProvider>
          <RootNavigator />
          <StatusBar style="auto" />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
