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
import { View, ActivityIndicator } from 'react-native';
import { Colors } from '../constants/Colors';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

// ── Auth'a Göre Yönlendiren İç Bileşen ───────────────────────
function RootNavigator() {
  const { user, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = (segments as string[])[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Oturum açık değil → Login'e yönlendir
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/(auth)/login' as any);
    } else if (user && inAuthGroup) {
      // Oturum açık ve auth grubundaysa → Ana ekrana yönlendir
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      router.replace('/(tabs)' as any);
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

// ── Root Layout ───────────────────────────────────────────────
export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootNavigator />
        <StatusBar style="dark" />
      </AuthProvider>
    </GestureHandlerRootView>
  );
}
