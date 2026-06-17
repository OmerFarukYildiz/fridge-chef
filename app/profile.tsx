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
  TextInput,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { auth } from '../services/firebaseConfig';
import { signOut } from 'firebase/auth';
import { changeUserPassword, changeUserDisplayName } from '../services/authService';
import {
  updateUserPhoto, updateUserAllergies, updateUserDietaryRestrictions, 
  createOrGetFamilyInvite, joinFamilyWithCode, leaveFamily,
  updateFitnessGoal, updateChildMode, updateLanguage, ALL_BADGES, updateKitchenEquipment
} from '../services/firestoreService';
import { Colors, AppThemeColors, Radius, Shadow, Spacing, Typography } from '../constants/Colors';
import { KitchenEquipment, FitnessGoal } from '../types';

const DIETARY_OPTIONS = [
  { id: 'Vegan', label: 'Vegan', icon: '🌱' },
  { id: 'Vejetaryen', label: 'Vejetaryen', icon: '🥦' },
  { id: 'Keto', label: 'Keto', icon: '🥩' },
  { id: 'Glutensiz', label: 'Glutensiz', icon: '🌾' },
  { id: 'Düşük Karbonhidrat', label: 'Düşük Karbonhidrat', icon: '🥗' },
  { id: 'Akdeniz Diyeti', label: 'Akdeniz Diyeti', icon: '🫒' },
];

const ALLERGY_OPTIONS = [
  { id: 'Fıstık', label: 'Fıstık', icon: '🥜' },
  { id: 'Laktoz', label: 'Laktoz', icon: '🥛' },
  { id: 'Gluten', label: 'Gluten', icon: '🌾' },
  { id: 'Yumurta', label: 'Yumurta', icon: '🥚' },
  { id: 'Deniz Ürünü', label: 'Deniz Ürünü', icon: '🦐' },
  { id: 'Soya', label: 'Soya', icon: '🫘' },
];

const FITNESS_GOALS = [
  { id: 'kilo_verme', label: 'Kilo Verme', icon: '📉' },
  { id: 'kas_gelistirme', label: 'Kas Geliştirme', icon: '💪' },
  { id: 'kilo_koruma', label: 'Kilo Koruma', icon: '⚖️' },
  { id: 'saglikli_yasam', label: 'Sağlıklı Yaşam', icon: '🌿' },
];

const KITCHEN_EQUIPMENT_OPTIONS = [
  { id: 'Fırın', icon: '🔥' },
  { id: 'Mikrodalga', icon: '⏲️' },
  { id: 'Airfryer', icon: '💨' },
  { id: 'Blender', icon: '🌪️' },
  { id: 'Tost Makinesi', icon: '🥪' },
  { id: 'Düdüklü Tencere', icon: '🍲' },
];

export default function ProfileScreen() {
  const router = useRouter();
  const { user, userProfile, refreshProfile } = useAuth();
  const { isDark, toggleTheme, colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  const [fitnessGoal, setFitnessGoalState] = useState<string | null>(null);
  const [childMode, setChildModeState] = useState(false);
  const [language, setLanguageState] = useState<'tr'|'en'|'de'>('tr');

  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Ad Soyad & Şifre Değiştirme
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Aile sistemi state'leri
  const [inviteCodeInput, setInviteCodeInput] = useState('');
  const [myInviteCode, setMyInviteCode] = useState<string | null>(null);
  const [loadingFamily, setLoadingFamily] = useState(false);

  useEffect(() => {
    if (userProfile?.preferences?.allergies) {
      setSelectedAllergies(userProfile.preferences.allergies);
    }
    if (userProfile?.preferences?.dietaryRestrictions) {
      setSelectedDiets(userProfile.preferences.dietaryRestrictions);
    }
    if (userProfile?.kitchenEquipment) setSelectedEquipment(userProfile.kitchenEquipment);
    if (userProfile?.fitnessGoal) setFitnessGoalState(userProfile.fitnessGoal);
    if (userProfile?.childMode !== undefined) setChildModeState(userProfile.childMode);
    if (userProfile?.language) setLanguageState(userProfile.language);
    if (userProfile?.displayName) setNewDisplayName(userProfile.displayName);
  }, [userProfile]);

  const handleUpdateDisplayName = async () => {
    if (!newDisplayName.trim()) {
      Alert.alert('Hata', 'Ad soyad alanı boş bırakılamaz.');
      return;
    }
    setNameSaving(true);
    try {
      await changeUserDisplayName(newDisplayName.trim());
      await refreshProfile();
      Alert.alert('Başarılı', 'Ad soyad bilginiz güncellendi.');
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Ad soyad güncellenirken bir hata oluştu.');
    } finally {
      setNameSaving(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword.trim() || newPassword.length < 6) {
      Alert.alert('Hata', 'Şifre en az 6 karakter olmalıdır.');
      return;
    }
    setPasswordSaving(true);
    try {
      await changeUserPassword(newPassword.trim());
      setNewPassword('');
      Alert.alert('Başarılı', 'Şifreniz başarıyla güncellendi.');
    } catch (err: any) {
      Alert.alert('Hata', err.message || 'Şifre güncellenirken bir hata oluştu.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const toggleDiet = (label: string) => {
    setSelectedDiets((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const toggleAllergy = (label: string) => {
    setSelectedAllergies((prev) =>
      prev.includes(label) ? prev.filter((i) => i !== label) : [...prev, label]
    );
  };

  const handleSavePreferences = async () => {
    if (!user) return;
    setSaving(true);
    try {
      await updateUserDietaryRestrictions(user.uid, selectedDiets);
      await updateUserAllergies(user.uid, selectedAllergies);
      await updateKitchenEquipment(user.uid, selectedEquipment as KitchenEquipment[]);
      await updateFitnessGoal(user.uid, fitnessGoal as FitnessGoal | null);
      await updateChildMode(user.uid, childMode);
      await updateLanguage(user.uid, language);
      await refreshProfile();
      Alert.alert('Başarılı', 'Tercihleriniz güncellendi.');
    } catch (error) {
      Alert.alert('Hata', 'Tercihler güncellenemedi.');
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

  const handleGenerateInvite = async () => {
    if (!user) return;
    setLoadingFamily(true);
    try {
      const code = await createOrGetFamilyInvite(user.uid);
      setMyInviteCode(code);
    } catch (e) {
      Alert.alert('Hata', 'Davet kodu oluşturulamadı.');
    } finally {
      setLoadingFamily(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Kopyalandı', 'Davet kodu panoya kopyalandı.');
  };

  const handleJoinFamily = async () => {
    if (!user || !inviteCodeInput.trim()) return;
    setLoadingFamily(true);
    try {
      await joinFamilyWithCode(user.uid, inviteCodeInput.trim());
      Alert.alert('Başarılı', 'Aileye katıldınız!');
      setInviteCodeInput('');
      await refreshProfile();
    } catch (e: any) {
      Alert.alert('Hata', e.message || 'Davet kodu geçersiz.');
    } finally {
      setLoadingFamily(false);
    }
  };

  const handleLeaveFamily = () => {
    if (!user) return;
    Alert.alert('Aileden Ayrıl', 'Aileden ayrılmak istediğinize emin misiniz? (Kendi alışveriş ve kiler listenize geri dönersiniz)', [
      { text: 'İptal', style: 'cancel' },
      { 
        text: 'Ayrıl', 
        style: 'destructive',
        onPress: async () => {
          setLoadingFamily(true);
          try {
            await leaveFamily(user.uid);
            await refreshProfile();
          } catch (e) {
            Alert.alert('Hata', 'Aileden ayrılamadınız.');
          } finally {
            setLoadingFamily(false);
          }
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

      {/* Aile Paylaşımı */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>👨‍👩‍👧 Aile Paylaşımı</Text>
        <Text style={styles.sectionSubtitle}>Alışveriş listenizi ve kilerinizi ailenizle ortak kullanın.</Text>
        
        <View style={styles.familyContainer}>
          {userProfile.familyId ? (
            <View style={styles.familyActive}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.primary} />
              <View style={styles.familyActiveText}>
                <Text style={styles.familyStatusText}>Bir aile grubundasınız.</Text>
                <Text style={styles.familyIdText}>Ortak kullanım aktif</Text>
              </View>
              <TouchableOpacity style={styles.leaveFamilyBtn} onPress={handleLeaveFamily} disabled={loadingFamily}>
                {loadingFamily ? <ActivityIndicator size="small" color={Colors.error} /> : <Text style={styles.leaveFamilyText}>Ayrıl</Text>}
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.familyJoin}>
              <View style={styles.joinRow}>
                <TextInput
                  style={styles.familyInput}
                  placeholder="Davet Kodunu Girin"
                  placeholderTextColor={Colors.textMuted}
                  value={inviteCodeInput}
                  onChangeText={setInviteCodeInput}
                  autoCapitalize="characters"
                />
                <TouchableOpacity style={styles.joinBtn} onPress={handleJoinFamily} disabled={loadingFamily || !inviteCodeInput.trim()}>
                  {loadingFamily ? <ActivityIndicator size="small" color="white" /> : <Text style={styles.joinBtnText}>Katıl</Text>}
                </TouchableOpacity>
              </View>
              
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>VEYA</Text>
                <View style={styles.dividerLine} />
              </View>
              
              {myInviteCode ? (
                <TouchableOpacity style={styles.inviteCodeBox} onPress={() => copyToClipboard(myInviteCode)}>
                  <Text style={styles.inviteCodeLabel}>Sizin Davet Kodunuz:</Text>
                  <Text style={styles.inviteCodeValue}>{myInviteCode}</Text>
                  <Text style={styles.inviteCodeHint}>(Kopyalamak için dokunun)</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={styles.generateBtn} onPress={handleGenerateInvite} disabled={loadingFamily}>
                  <Ionicons name="people" size={18} color={Colors.primary} />
                  <Text style={styles.generateBtnText}>Davet Kodu Oluştur</Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Sağlık Raporu */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🩺 Sağlık ve Beslenme</Text>
        <Text style={styles.sectionSubtitle}>Haftalık kalori ve beslenme raporunuzu inceleyin.</Text>
        <TouchableOpacity style={styles.healthReportBtn} onPress={() => router.push('/health-report' as any)}>
          <Ionicons name="fitness" size={20} color="white" />
          <Text style={styles.healthReportBtnText}>Haftalık Sağlık Raporu</Text>
        </TouchableOpacity>
      </View>

      {/* Diyet Tercihlerim */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🥗 Diyet Tercihlerim</Text>
        <Text style={styles.sectionSubtitle}>Seçtiğiniz diyete uygun tarifler önerilecektir.</Text>
        
        <View style={styles.chipsGrid}>
          {DIETARY_OPTIONS.map((option) => {
            const isSelected = selectedDiets.includes(option.label);
            return (
              <TouchableOpacity
                key={option.id}
                style={[styles.chip, isSelected && styles.chipSelected]}
                onPress={() => toggleDiet(option.label)}
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
      </View>

      {/* Alerjiler */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚠️ Alerjilerim</Text>
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
      </View>

      {/* ── Ayarlar ───────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Ayarlar</Text>

        {/* Dark Mode */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name={isDark ? 'moon' : 'sunny-outline'} size={22} color={colors.primary} />
            <View>
              <Text style={styles.settingLabel}>{isDark ? 'Karanlık Mod' : 'Aydınlık Mod'}</Text>
              <Text style={styles.settingDesc}>Tema tercihini değiştir</Text>
            </View>
          </View>
          <Switch value={isDark} onValueChange={toggleTheme}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={isDark ? '#fff' : '#f4f3f4'} />
        </View>

        {/* Çocuk Modu */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="happy-outline" size={22} color="#F59E0B" />
            <View>
              <Text style={styles.settingLabel}>Çocuk Modu</Text>
              <Text style={styles.settingDesc}>Yumuşak, eğlenceli ve az baharatlı tarifler</Text>
            </View>
          </View>
          <Switch value={childMode} onValueChange={setChildModeState}
            trackColor={{ false: colors.border, true: '#F59E0B' }}
            thumbColor={childMode ? '#fff' : '#f4f3f4'} />
        </View>

        {/* Dil Seçimi */}
        <View style={styles.settingRow}>
          <View style={styles.settingLeft}>
            <Ionicons name="language-outline" size={22} color="#6366F1" />
            <View>
              <Text style={styles.settingLabel}>Uygulama Dili</Text>
              <Text style={styles.settingDesc}>Tarif dili / prompt dili</Text>
            </View>
          </View>
          <View style={styles.langButtons}>
            {(['tr', 'en', 'de'] as const).map((lang) => (
              <TouchableOpacity
                key={lang}
                style={[styles.langBtn, language === lang && styles.langBtnActive]}
                onPress={() => setLanguageState(lang)}
              >
                <Text style={[styles.langBtnText, language === lang && styles.langBtnTextActive]}>
                  {lang.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* ── Fitness Hedefi ─────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>💪 Fitness Hedefim</Text>
        <Text style={styles.sectionSubtitle}>Tarifler ve makrolar bu hedefe göre ayarlanır.</Text>
        <View style={styles.chipsGrid}>
          {FITNESS_GOALS.map((goal) => {
            const isActive = fitnessGoal === goal.id;
            return (
              <TouchableOpacity
                key={goal.id}
                style={[styles.chip, isActive && styles.chipSelected]}
                onPress={() => setFitnessGoalState(isActive ? null : goal.id)}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{goal.icon}</Text>
                <Text style={[styles.chipLabel, isActive && styles.chipLabelSelected]}>{goal.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Mutfak Envanteri ────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Mutfak Aletlerim</Text>
        <Text style={styles.sectionSubtitle}>Seçili aletler tariflerinizde önceliklendirilir. Kapalı = Şu an kullanılmıyor.</Text>
        <View style={styles.chipsGrid}>
          {KITCHEN_EQUIPMENT_OPTIONS.map((eq) => {
            const isActive = selectedEquipment.includes(eq.id);
            return (
              <TouchableOpacity
                key={eq.id}
                style={[styles.chip, isActive && styles.chipSelected]}
                onPress={() => setSelectedEquipment((prev) =>
                  prev.includes(eq.id) ? prev.filter((e) => e !== eq.id) : [...prev, eq.id]
                )}
                activeOpacity={0.7}
              >
                <Text style={styles.chipIcon}>{eq.icon}</Text>
                <Text style={[styles.chipLabel, isActive && styles.chipLabelSelected]}>{eq.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* ── Rozetlerim ─────────────────────────────────────────────── */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏆 Rozetlerim</Text>
        <Text style={styles.sectionSubtitle}>
          {(userProfile?.badges?.length ?? 0)} / {ALL_BADGES.length} rozet kazanıldı
        </Text>
        <View style={styles.badgesGrid}>
          {ALL_BADGES.map((badge) => {
            const earned = userProfile?.badges?.find((b) => b.id === badge.id);
            return (
              <View key={badge.id} style={[styles.badgeCard, !earned && styles.badgeCardLocked]}>
                <Text style={[styles.badgeEmoji, !earned && styles.badgeEmojiLocked]}>
                  {earned ? badge.emoji : '🔒'}
                </Text>
                <Text style={[styles.badgeName, !earned && styles.badgeNameLocked]} numberOfLines={2}>
                  {earned ? badge.name : '???'}
                </Text>
                {earned && (
                  <Text style={styles.badgeDate}>
                    {new Date(earned.earnedAt!).toLocaleDateString('tr-TR')}
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* Kaydet Butonu */}
      <View style={styles.section}>
        <TouchableOpacity 
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSavePreferences}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={styles.saveButtonText}>Değişiklikleri Kaydet</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Hesap Ayarları */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔒 Hesap Ayarları</Text>
        <Text style={styles.sectionSubtitle}>Ad soyad ve şifre bilgilerinizi güncelleyin.</Text>

        {/* Ad Soyad Güncelleme */}
        <View style={styles.settingInputRow}>
          <TextInput
            style={styles.settingInput}
            placeholder="Ad Soyad"
            placeholderTextColor={colors.textMuted}
            value={newDisplayName}
            onChangeText={setNewDisplayName}
            autoCapitalize="words"
          />
          <TouchableOpacity
            style={[styles.settingActionBtn, (!newDisplayName.trim() || nameSaving) && styles.settingActionBtnDisabled]}
            onPress={handleUpdateDisplayName}
            disabled={!newDisplayName.trim() || nameSaving}
          >
            {nameSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.settingActionBtnText}>Güncelle</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Şifre Güncelleme */}
        <View style={styles.settingInputRow}>
          <TextInput
            style={styles.settingInput}
            placeholder="Yeni Şifre (en az 6 karakter)"
            placeholderTextColor={colors.textMuted}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
          />
          <TouchableOpacity
            style={[styles.settingActionBtn, (newPassword.length < 6 || passwordSaving) && styles.settingActionBtnDisabled]}
            onPress={handleUpdatePassword}
            disabled={newPassword.length < 6 || passwordSaving}
          >
            {passwordSaving ? (
              <ActivityIndicator size="small" color="white" />
            ) : (
              <Text style={styles.settingActionBtnText}>Değiştir</Text>
            )}
          </TouchableOpacity>
        </View>
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

const getStyles = (colors: AppThemeColors) => StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  root: {
    flex: 1,
    backgroundColor: colors.background,
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
    backgroundColor: colors.border,
  },
  avatarText: {
    fontSize: Typography['4xl'],
    fontWeight: '800',
    color: colors.white,
  },
  editIconBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: colors.textPrimary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: colors.background,
  },
  nameText: {
    fontSize: Typography.xl,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  emailText: {
    fontSize: Typography.sm,
    color: colors.textSecondary,
    marginTop: 4,
  },
  section: {
    backgroundColor: colors.surface,
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    marginBottom: Spacing.xl,
    ...Shadow.sm,
  },
  sectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: Typography.sm,
    color: colors.textMuted,
    marginBottom: Spacing.lg,
  },
  chipsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: Radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: '#FFF4E6',
  },
  chipIcon: {
    fontSize: 16,
  },
  chipLabel: {
    fontSize: Typography.sm,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  chipLabelSelected: {
    color: colors.primary,
    fontWeight: '700',
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: colors.white,
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
    backgroundColor: colors.errorLight,
    borderWidth: 1,
    borderColor: colors.error,
  },
  logoutText: {
    color: colors.error,
    fontWeight: '700',
    fontSize: Typography.base,
  },
  // ── Aile Hesapları ──────────────────────────────────────────
  familyContainer: {
    marginTop: Spacing.sm,
  },
  familyActive: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  familyActiveText: { flex: 1 },
  familyStatusText: { fontSize: Typography.base, fontWeight: '600', color: colors.textPrimary },
  familyIdText: { fontSize: Typography.xs, color: colors.textMuted, marginTop: 2 },
  leaveFamilyBtn: { paddingVertical: 6, paddingHorizontal: 12, backgroundColor: 'rgba(239,68,68,0.1)', borderRadius: Radius.md },
  leaveFamilyText: { color: colors.error, fontWeight: '600', fontSize: Typography.sm },
  familyJoin: { gap: 12 },
  joinRow: { flexDirection: 'row', gap: 8 },
  familyInput: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: 10, fontSize: Typography.base, color: colors.textPrimary, backgroundColor: colors.background },
  joinBtn: { backgroundColor: colors.primary, paddingHorizontal: 16, justifyContent: 'center', borderRadius: Radius.md },
  joinBtnText: { color: 'white', fontWeight: '700' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { marginHorizontal: 8, fontSize: Typography.xs, color: colors.textMuted, fontWeight: '600' },
  generateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 10, borderWidth: 1, borderColor: colors.primary, borderRadius: Radius.md, borderStyle: 'dashed' },
  generateBtnText: { color: colors.primary, fontWeight: '600', fontSize: Typography.sm },
  inviteCodeBox: { backgroundColor: 'rgba(249,115,22,0.1)', padding: 12, borderRadius: Radius.md, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(249,115,22,0.3)' },
  inviteCodeLabel: { fontSize: Typography.xs, color: colors.textSecondary },
  inviteCodeValue: { fontSize: Typography.xl, fontWeight: '800', color: colors.primary, marginVertical: 4, letterSpacing: 2 },
  inviteCodeHint: { fontSize: Typography.xs, color: colors.textMuted },
  // ── Sağlık Raporu ───────────────────────────────────────────
  healthReportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.primary, paddingVertical: 12, borderRadius: Radius.md, marginTop: 8 },
  healthReportBtnText: { color: 'white', fontWeight: '700', fontSize: Typography.base },
  // ── Ayarlar & Rozetler vb. ──────────────────────────────────
  settingRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  settingLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  settingLabel: { fontSize: Typography.base, fontWeight: '600', color: colors.textPrimary },
  settingDesc: { fontSize: Typography.xs, color: colors.textMuted, marginTop: 2, paddingRight: 8 },
  langButtons: { flexDirection: 'row', gap: 6 },
  langBtn: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: Radius.sm, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.border },
  langBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  langBtnText: { fontSize: Typography.xs, fontWeight: '600', color: colors.textSecondary },
  langBtnTextActive: { color: 'white' },
  
  badgesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: Spacing.sm },
  badgeCard: {
    width: '48%', backgroundColor: colors.background, padding: Spacing.base,
    borderRadius: Radius.lg, alignItems: 'center', borderWidth: 1, borderColor: colors.border,
  },
  badgeCardLocked: { opacity: 0.5, backgroundColor: colors.surface },
  badgeEmoji: { fontSize: 32, marginBottom: 8 },
  badgeEmojiLocked: { opacity: 0.3 },
  badgeName: { fontSize: Typography.sm, fontWeight: '700', color: colors.textPrimary, textAlign: 'center' },
  badgeNameLocked: { color: colors.textMuted },
  badgeDate: { fontSize: 10, color: colors.textMuted, marginTop: 4 },

  // ── Hesap Ayarları Stilleri ──
  settingInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: Spacing.md,
  },
  settingInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: 10,
    fontSize: Typography.base,
    color: colors.textPrimary,
    backgroundColor: colors.background,
  },
  settingActionBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: Radius.md,
    minWidth: 80,
  },
  settingActionBtnDisabled: {
    opacity: 0.6,
  },
  settingActionBtnText: {
    color: 'white',
    fontWeight: '700',
    fontSize: Typography.sm,
  },
});
