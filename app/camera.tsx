// ============================================================
// Fridge Chef — Kamera Ekranı
// ============================================================
// RAM SORUNU ÇÖZÜMÜ:
//   takePicture() → expo-image-manipulator ile boyut küçültme
//   (800px genişlik, %50 sıkıştırma) → base64'e çevirme
//   Bu yaklaşım bellek kullanımını ~%75 azaltır.
// ============================================================

import React, { useState, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  ActivityIndicator,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImageManipulator from 'expo-image-manipulator';
import { Colors, Radius, Shadow } from '../constants/Colors';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [facing, setFacing] = useState<'back' | 'front'>('back');
  const [flash, setFlash] = useState<'off' | 'on'>('off');
  const [isProcessing, setIsProcessing] = useState(false);
  const cameraRef = useRef<CameraView>(null);
  const router = useRouter();

  // ── İzin Bekleniyorsa ─────────────────────────────────────
  if (!permission) {
    return <View style={styles.container} />;
  }

  // ── İzin Verilmemişse ─────────────────────────────────────
  if (!permission.granted) {
    return (
      <View style={styles.permissionContainer}>
        <Ionicons name="camera-outline" size={64} color={Colors.primary} />
        <Text style={styles.permissionTitle}>Kamera İzni Gerekli</Text>
        <Text style={styles.permissionText}>
          Malzemelerinizi taramak için kamera erişimine ihtiyacımız var.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>İzin Ver</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const toggleCameraFacing = () => {
    setFacing((current) => (current === 'back' ? 'front' : 'back'));
  };

  const toggleFlash = () => {
    setFlash((current) => (current === 'off' ? 'on' : 'off'));
  };

  // ── Fotoğraf Çek + Optimize Et ────────────────────────────
  // ADIM 1: Ham fotoğraf çek (base64 istemeden — RAM tasarrufu için)
  // ADIM 2: ImageManipulator ile yeniden boyutlandır + sıkıştır
  // ADIM 3: Manipüle edilmiş görseli base64 olarak al ve recipe sayfasına geç
  const takePicture = async () => {
    if (!cameraRef.current || isProcessing) return;

    setIsProcessing(true);
    try {
      // ADIM 1: Ham fotoğrafı URI olarak çek (base64: false → daha az RAM)
      const photo = await cameraRef.current.takePictureAsync({
        base64: false,
        quality: 1, // Önce tam kalite, manipülatör sıkıştıracak
        skipProcessing: false,
      });

      if (!photo?.uri) {
        throw new Error('Fotoğraf URI alınamadı.');
      }

      // ADIM 2: Görsel küçültme + sıkıştırma
      // width: 800 → tipik olarak 500KB altına düşürür
      // compress: 0.5 → JPEG kalite %50 (API için yeterli)
      const manipulated = await ImageManipulator.manipulateAsync(
        photo.uri,
        [{ resize: { width: 800 } }],
        {
          compress: 0.5,
          format: ImageManipulator.SaveFormat.JPEG,
          base64: true, // Son adımda base64 al
        }
      );

      if (!manipulated.base64) {
        throw new Error('Görsel base64 formatına çevrilemedi.');
      }

      // ADIM 3: Recipe sayfasına geç
      router.push({
        pathname: '/recipe',
        params: { base64Image: manipulated.base64 },
      });
    } catch (error) {
      console.error('[Camera] Fotoğraf çekilirken hata:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <View style={styles.container}>
      <CameraView
        style={styles.camera}
        facing={facing}
        enableTorch={flash === 'on'}
        ref={cameraRef}
      >
        {/* Üst Kontroller */}
        <View style={styles.headerControls}>
          <TouchableOpacity
            style={styles.iconButton}
            onPress={() => router.back()}
            accessibilityLabel="Geri git"
          >
            <Ionicons name="close" size={28} color="white" />
          </TouchableOpacity>

          <Text style={styles.headerTitle}>Malzemeleri Tara</Text>

          <TouchableOpacity
            style={styles.iconButton}
            onPress={toggleFlash}
            accessibilityLabel={flash === 'on' ? 'Flaşı kapat' : 'Flaşı aç'}
          >
            <Ionicons
              name={flash === 'on' ? 'flash' : 'flash-off'}
              size={24}
              color={flash === 'on' ? Colors.primary : 'white'}
            />
          </TouchableOpacity>
        </View>

        {/* Kılavuz Çerçevesi */}
        <View style={styles.scanFrame}>
          <View style={[styles.corner, styles.topLeft]} />
          <View style={[styles.corner, styles.topRight]} />
          <View style={[styles.corner, styles.bottomLeft]} />
          <View style={[styles.corner, styles.bottomRight]} />
        </View>

        {/* İpucu Metni */}
        <Text style={styles.hintText}>
          Buzdolabınızı veya malzemelerinizi çerçeve içine alın
        </Text>

        {/* Alt Kontroller */}
        <View style={styles.bottomControls}>
          {/* Sol boşluk (düzenleme için) */}
          <View style={styles.sideButton} />

          {/* Çekim Butonu */}
          <TouchableOpacity
            style={[styles.captureButton, isProcessing && styles.captureButtonDisabled]}
            onPress={takePicture}
            disabled={isProcessing}
            accessibilityLabel="Fotoğraf çek"
          >
            {isProcessing ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.captureInner} />
            )}
          </TouchableOpacity>

          {/* Kamera Çevir */}
          <TouchableOpacity
            style={styles.sideButton}
            onPress={toggleCameraFacing}
            accessibilityLabel="Kamerayı çevir"
          >
            <Ionicons name="camera-reverse" size={28} color="white" />
          </TouchableOpacity>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  // ── İzin ─────────────────────────────────────────────────
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 32,
    gap: 16,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  permissionText: {
    fontSize: 16,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  permissionButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: Radius.xl,
    marginTop: 8,
    ...Shadow.md,
  },
  permissionButtonText: {
    color: Colors.white,
    fontSize: 18,
    fontWeight: '700',
  },
  // ── Header ───────────────────────────────────────────────
  headerControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
  },
  headerTitle: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // ── Tarama Çerçevesi ──────────────────────────────────────
  scanFrame: {
    width: '75%',
    height: '42%',
    alignSelf: 'center',
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: Colors.primary,
    borderWidth: 3,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 4,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 4,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 4,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 4,
  },
  // ── İpucu ────────────────────────────────────────────────
  hintText: {
    color: 'rgba(255, 255, 255, 0.75)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 40,
  },
  // ── Alt Kontroller ────────────────────────────────────────
  bottomControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingBottom: 60,
    paddingTop: 20,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderWidth: 3,
    borderColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonDisabled: {
    opacity: 0.6,
  },
  captureInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'white',
  },
  sideButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
