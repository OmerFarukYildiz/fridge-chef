// ============================================================
// Fridge Chef — Profil Ekranı
// ============================================================

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';
import { updateUserPhoto, updateUserAllergies } from '../services/firestoreService';
import { Colors, Radius, Shadow, Spacing, Typography } from '../constants/Colors';

const ALLERGY_OPTIONS = [
  { id: 'Fıstık', label: 'Fıstık', icon: '🥜' },
  { id: 'Laktoz', label: 'Laktoz', icon: '🥛' },
  { id: 'Gluten', label: 'Gluten', icon: '🌾' },
  { id: 'Yumurta', label: 'Yumurta', icon: '🥚' },
  { id: 'Deniz Ürünü', label: 'Deniz Ürünü', icon: '🦐' },
  { id: 'Soya', label: 'Soya', icon: '🫘' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    if (userProfile?.preferences?.allergies) {
      setSelectedAllergies(userProfile.preferences.allergies);
    }
  }, [userProfile]);

  const toggleAllergy = (label: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const handleSaveAllergies = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserAllergies(user.uid, selectedAllergies);
      await refreshProfile();
      Alert.alert('Başarılı', 'Alerjileriniz güncellendi.');
    } catch (error) {
      Alert.alert('Hata', 'Alerjiler güncellenemedi.');
    } finally {
      setSaving(false);
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setUploadingImage(true);
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 400, height: 400 } }],
          { compress: 0.5, format: ImageManipulator.SaveFormat.JPEG, base64: true }
        );
        
        if (manipulated.base64 && user) {
          const base64String = `data:image/jpeg;base64,${manipulated.base64}`;
          await updateUserPhoto(user.uid, base64String);
          await refreshProfile();
        }
      } catch (error) {
        Alert.alert('Hata', 'Fotoğraf güncellenemedi.');
      } finally {
        setUploadingImage(false);
      }
    }
  };

  const handleLogout = async () => {
    Alert.alert('Çıkış Yap', 'Hesabınızdan çıkış yapmak istediğinize emin misiniz?', [
      { text: 'İptal', style: 'cancel' },
      { 
        text: 'Çıkış Yap', 
        style: 'destructive',
        onPress: async () => {
          await signOut(auth);
          // router.replace will happen automatically via AuthContext
        }
      }
    ]);
  };

  if (!userProfile) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  const firstName = userProfile.displayName?.split(' ')[0] ?? 'Şef';
  const initial = firstName.charAt(0).toUpperCase();

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      {/* Header Info */}
      <View style={styles.headerSection}>
        <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage} disabled={uploadingImage}>
          {uploadingImage ? (
            <View style={[styles.avatarCircle, styles.avatarLoading]}>
              <ActivityIndicator color="white" />
            </View>
          ) : userProfile.photoBase64 ? (
            <Image source={{ uri: userProfile.photoBase64 }} style={styles.avatarImage} />
          ) : (
            <LinearGradient
              colors={[Colors.gradientStart, Colors.gradientEnd]}
              style={styles.avatarCircle}
            >
              <Text style={styles.avatarText}>{initial}</Text>
            </LinearGradient>
          )}
          <View style={styles.editIconBadge}>
            <Ionicons name="camera" size={14} color="white" />
          </View>
        </TouchableOpacity>
        
        <Text style={styles.nameText}>{userProfile.displayName}</Text>
        <Text style={styles.emailText}>{userProfile.email}</Text>
      </View>

      {/* Alerjiler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alerjilerim</Text>
        <Text style={styles.sectionSubtitle}>Seçilen alerjenler tariflerde kullanılmaz.</Text>
        
        <View style={styles.chipsGrid}>
          {ALLERGY_OPTIONS.map((option) => {
            const isSelected = selectedAllergies.includes(option.label);
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleAllergy(option.label)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{option.icon}</Text>
                <Text style={[styles.chipLabel, isSelected && styles.chipLabelSelected]}>
                  {option.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSaveAllergies}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Çıkış */}
      <View style={styles.section}>
        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Ionicons name="log-out-outline" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>Çıkış Yap</Text>
        </TouchableOpacity>
      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    padding: Spacing.xl,
    paddingBottom: 40,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: Spacing.base,
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    ...Shadow.md,
  },
  avatarLoading: {
    backgroundColor: Colors.border,
  },
  avatarText: {
    fontSize: Typography['4xl'],
    fontWeight: '800',
    color: Colors.white,
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: Colors.textPrimary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: Colors.background,
  },
  nameText: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  emailText: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    marginTop: 4,
  },
  section: {
    backgroundColor: Colors.surface,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: Typography.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: Spacing.xl,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  chipSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#FFF4E6',
  },
  chipIcon: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: Typography.sm,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Typography.base,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    backgroundColor: Colors.errorLight,
    borderWidth: 1,
    borderColor: Colors.error,
  },
  logoutText: {
    color: Colors.error,
    fontWeight: '700',
    fontSize: Typography.base,
  },
});
