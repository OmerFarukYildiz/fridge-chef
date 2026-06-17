// ============================================================
// Fridge Chef — Kayıt Ekranı
// ============================================================
// Adım adım kayıt akışı:
//   Adım 1: Ad, E-posta, Şifre
//   Adım 2: Diyet tercihleri ve alerjiler (Gemini prompt'una enjekte edilir)
// ============================================================

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { registerUser } from '../../services/authService';
import { UserPreferences } from '../../types';
import { Colors, Radius, Shadow, Spacing, Typography } from '../../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';

// ── Seçim Verileri ─────────────────────────────────────────────
const DIETARY_OPTIONS = [
  { id: 'vegan', label: 'Vegan', icon: '🌱' },
  { id: 'vejetaryen', label: 'Vejetaryen', icon: '🥦' },
  { id: 'keto', label: 'Keto', icon: '🥩' },
  { id: 'glutensiz', label: 'Glutensiz', icon: '🌾' },
  { id: 'dusuk_karbonhidrat', label: 'Düşük Karbonhidrat', icon: '🥗' },
  { id: 'akdeniz', label: 'Akdeniz Diyeti', icon: '🫒' },
];

const ALLERGY_OPTIONS = [
  { id: 'fistik', label: 'Fıstık', icon: '🥜' },
  { id: 'laktoz', label: 'Laktoz', icon: '🥛' },
  { id: 'gluten', label: 'Gluten', icon: '🌾' },
  { id: 'yumurta', label: 'Yumurta', icon: '🥚' },
  { id: 'deniz_urunu', label: 'Deniz Ürünü', icon: '🦐' },
  { id: 'soya', label: 'Soya', icon: '🫘' },
];

// ── Seçim Chip Bileşeni ─────────────────────────────────────────
interface ChipProps {
  label: string;
  icon: string;
  selected: boolean;
  onPress: () => void;
}

function SelectionChip({ label, icon, selected, onPress }: ChipProps) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
      activeOpacity={0.75}
    >
      <Text style={styles.chipIcon}>{icon}</Text>
      <Text style={[styles.chipLabel, selected && styles.chipLabelSelected]}>
        {label}
      </Text>
      {selected && (
        <Ionicons name="checkmark-circle" size={16} color={Colors.primary} />
      )}
    </TouchableOpacity>
  );
}

// ── Ana Ekran ──────────────────────────────────────────────────
export default function RegisterScreen() {
  const router = useRouter();

  // Form adımı (1 = kişisel bilgiler, 2 = tercihler)
  const [step, setStep] = useState(1);

  // Adım 1 state
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Adım 2 state
  const [selectedDiets, setSelectedDiets] = useState<string[]>([]);
  const [selectedAllergies, setSelectedAllergies] = useState<string[]>([]);

  // Genel state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Seçim Toggle ─────────────────────────────────────────────
  const toggleSelection = (
    id: string,
    list: string[],
    setList: (l: string[]) => void
  ) => {
    setList(list.includes(id) ? list.filter((i) => i !== id) : [...list, id]);
  };

  // ── Adım 1 Doğrulama ─────────────────────────────────────────
  const handleNextStep = () => {
    if (!displayName.trim()) return setError('Lütfen adınızı girin.');
    if (!email.trim()) return setError('Lütfen e-posta adresinizi girin.');
    if (!password) return setError('Lütfen bir şifre girin.');
    if (password.length < 6) return setError('Şifre en az 6 karakter olmalıdır.');
    if (password !== confirmPassword) return setError('Şifreler eşleşmiyor.');
    setError(null);
    setStep(2);
  };

  // ── Kayıt Tamamla ─────────────────────────────────────────────
  const handleRegister = async () => {
    setError(null);
    setLoading(true);

    const preferences: UserPreferences = {
      dietaryRestrictions: selectedDiets.map(
        (id) => DIETARY_OPTIONS.find((o) => o.id === id)?.label ?? id
      ),
      allergies: selectedAllergies.map(
        (id) => ALLERGY_OPTIONS.find((o) => o.id === id)?.label ?? id
      ),
    };

    try {
      await registerUser(email.trim(), password, displayName.trim(), preferences);
      // AuthContext'teki onAuthStateChanged otomatik (tabs)'a yönlendirir
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Kayıt başarısız.');
    } finally {
      setLoading(false);
    }
  };

  // ── Adım Göstergesi ────────────────────────────────────────────
  const StepIndicator = () => (
    <View style={styles.stepIndicator}>
      <View style={[styles.stepDot, step >= 1 && styles.stepDotActive]}>
        <Text style={styles.stepDotText}>1</Text>
      </View>
      <View style={[styles.stepLine, step >= 2 && styles.stepLineActive]} />
      <View style={[styles.stepDot, step >= 2 && styles.stepDotActive]}>
        <Text style={styles.stepDotText}>2</Text>
      </View>
    </View>
  );

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Gradient Header */}
        <LinearGradient
          colors={[Colors.gradientStart, Colors.gradientEnd]}
          style={styles.header}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => (step === 2 ? setStep(1) : router.back())}
          >
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hesap Oluştur</Text>
          <Text style={styles.headerSubtitle}>
            {step === 1 ? 'Kişisel bilgilerini gir' : 'Tercihlerini belirle'}
          </Text>
        </LinearGradient>

        {/* Form Kartı */}
        <View style={styles.formCard}>
          <StepIndicator />

          {/* Hata Kutusu */}
          {error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.error} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* ── ADIM 1: Kişisel Bilgiler ── */}
          {step === 1 && (
            <View>
              {/* Ad Soyad */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Ad Soyad</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="person-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="ad soyad"
                    placeholderTextColor={Colors.textMuted}
                    value={displayName}
                    onChangeText={setDisplayName}
                    autoCapitalize="words"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* E-posta */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>E-posta</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="mail-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="ornek@email.com"
                    placeholderTextColor={Colors.textMuted}
                    value={email}
                    onChangeText={setEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    autoComplete="email"
                    returnKeyType="next"
                  />
                </View>
              </View>

              {/* Şifre */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Şifre</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, styles.inputFlex]}
                    placeholder="En az 6 karakter"
                    placeholderTextColor={Colors.textMuted}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="next"
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword((v) => !v)}
                    style={styles.eyeButton}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={Colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Şifre Tekrar */}
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Şifre Tekrar</Text>
                <View style={styles.inputWrapper}>
                  <Ionicons name="lock-closed-outline" size={20} color={Colors.textMuted} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="Şifrenizi tekrar girin"
                    placeholderTextColor={Colors.textMuted}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showPassword}
                    returnKeyType="done"
                    onSubmitEditing={handleNextStep}
                  />
                </View>
              </View>

              {/* İleri Butonu */}
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={handleNextStep}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.gradientStart, Colors.gradientEnd]}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.primaryButtonText}>Devam Et</Text>
                  <Ionicons name="arrow-forward" size={20} color="white" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* ── ADIM 2: Diyet Tercihleri ── */}
          {step === 2 && (
            <View>
              {/* Diyet Seçimi */}
              <View style={styles.preferenceSection}>
                <Text style={styles.preferenceSectionTitle}>🥗 Diyet Tercihlerin</Text>
                <Text style={styles.preferenceSectionSubtitle}>
                  Seçtiğin diyete uygun tarifler önerilecektir (opsiyonel)
                </Text>
                <View style={styles.chipsGrid}>
                  {DIETARY_OPTIONS.map((option) => (
                    <SelectionChip
                      key={option.id}
                      label={option.label}
                      icon={option.icon}
                      selected={selectedDiets.includes(option.id)}
                      onPress={() => toggleSelection(option.id, selectedDiets, setSelectedDiets)}
                    />
                  ))}
                </View>
              </View>

              {/* Alerji Seçimi */}
              <View style={styles.preferenceSection}>
                <Text style={styles.preferenceSectionTitle}>⚠️ Alerjilerin</Text>
                <Text style={styles.preferenceSectionSubtitle}>
                  Seçilen alerjenler tariflerde kesinlikle kullanılmaz
                </Text>
                <View style={styles.chipsGrid}>
                  {ALLERGY_OPTIONS.map((option) => (
                    <SelectionChip
                      key={option.id}
                      label={option.label}
                      icon={option.icon}
                      selected={selectedAllergies.includes(option.id)}
                      onPress={() =>
                        toggleSelection(option.id, selectedAllergies, setSelectedAllergies)
                      }
                    />
                  ))}
                </View>
              </View>

              {/* Atlama Notu */}
              <Text style={styles.skipNote}>
                💡 Daha sonra profil ayarlarından değiştirebilirsin
              </Text>

              {/* Kayıt Ol Butonu */}
              <TouchableOpacity
                style={[styles.primaryButton, loading && styles.buttonDisabled]}
                onPress={handleRegister}
                disabled={loading}
                activeOpacity={0.85}
              >
                <LinearGradient
                  colors={[Colors.secondary, Colors.secondaryDark]}
                  style={styles.primaryButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="white" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle-outline" size={20} color="white" />
                      <Text style={styles.primaryButtonText}>Hesabı Oluştur</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {/* Giriş Linki (Sadece Adım 1'de) */}
          {step === 1 && (
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => router.back()}
            >
              <Text style={styles.loginLinkText}>Zaten hesabın var mı? </Text>
              <Text style={[styles.loginLinkText, styles.loginLinkHighlight]}>
                Giriş Yap
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
  },
  // ── Header ─────────────────────────────────────────────────
  header: {
    paddingTop: 64,
    paddingBottom: 40,
    paddingHorizontal: Spacing.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.base,
  },
  headerTitle: {
    fontSize: Typography['3xl'],
    fontWeight: '800',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: Typography.base,
    color: 'rgba(255,255,255,0.85)',
    marginTop: 4,
  },
  // ── Form Kartı ─────────────────────────────────────────────
  formCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    marginTop: -20,
    padding: Spacing.xl,
    paddingTop: Spacing['2xl'],
    ...Shadow.lg,
  },
  // ── Adım Göstergesi ────────────────────────────────────────
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepDotActive: {
    backgroundColor: Colors.primary,
  },
  stepDotText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: Typography.sm,
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  stepLineActive: {
    backgroundColor: Colors.primary,
  },
  // ── Hata Kutusu ────────────────────────────────────────────
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.errorLight,
    padding: 12,
    borderRadius: Radius.md,
    marginBottom: Spacing.base,
    borderLeftWidth: 3,
    borderLeftColor: Colors.error,
  },
  errorText: {
    flex: 1,
    fontSize: Typography.sm,
    color: Colors.error,
    fontWeight: '500',
  },
  // ── Input ──────────────────────────────────────────────────
  inputGroup: {
    marginBottom: Spacing.base,
  },
  inputLabel: {
    fontSize: Typography.sm,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginBottom: 6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 12,
    height: 52,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: Typography.base,
    color: Colors.textPrimary,
  },
  inputFlex: {
    flex: 1,
  },
  eyeButton: {
    padding: 4,
  },
  // ── Butonlar ───────────────────────────────────────────────
  primaryButton: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginTop: Spacing.base,
    ...Shadow.md,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
  },
  primaryButtonText: {
    color: Colors.white,
    fontSize: Typography.lg,
    fontWeight: '700',
  },
  // ── Tercih Bölümleri ───────────────────────────────────────
  preferenceSection: {
    marginBottom: Spacing.xl,
  },
  preferenceSectionTitle: {
    fontSize: Typography.lg,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 4,
  },
  preferenceSectionSubtitle: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    lineHeight: 18,
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
  skipNote: {
    fontSize: Typography.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    marginBottom: Spacing.base,
  },
  // ── Alt Link ────────────────────────────────────────────────
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: Spacing.base,
    marginTop: Spacing.sm,
  },
  loginLinkText: {
    fontSize: Typography.base,
    color: Colors.textSecondary,
  },
  loginLinkHighlight: {
    color: Colors.primary,
    fontWeight: '700',
  },
});
