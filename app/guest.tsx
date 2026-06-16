import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getPantryItems } from '../services/firestoreService';
import { getGuestFriendlyRecipes } from '../services/geminiService';
import { AppThemeColors, Radius, Shadow, Spacing, Typography } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

export default function GuestScreen() {
  const { user, userProfile } = useAuth();
  const router = useRouter();
  const { isDark, colors } = useTheme();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [guestName, setGuestName] = useState('');
  const [restriction, setRestriction] = useState('');
  const [guests, setGuests] = useState<{ name: string; restrictions: string[] }[]>([]);
  const [loading, setLoading] = useState(false);

  const handleAddGuest = () => {
    if (!guestName.trim() || !restriction.trim()) {
      Alert.alert('Eksik Bilgi', 'Lütfen misafir adını ve diyet/alerji bilgisini girin.');
      return;
    }

    setGuests((prev) => [
      ...prev,
      { name: guestName.trim(), restrictions: [restriction.trim()] }
    ]);
    setGuestName('');
    setRestriction('');
  };

  const handleRemoveGuest = (index: number) => {
    setGuests((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!user) return;
    if (guests.length === 0) {
      Alert.alert('Misafir Yok', 'Lütfen en az bir misafir ekleyin.');
      return;
    }

    setLoading(true);
    try {
      const pantry = await getPantryItems(user.uid);
      const items = pantry.map((i) => i.name);
      const options = await getGuestFriendlyRecipes(items, guests, userProfile ?? undefined);
      
      router.push({
        pathname: '/recipe-picker' as any,
        params: {
          optionsJson: JSON.stringify(options),
          identifiedItems: items.join(', '),
        },
      });
    } catch (error) {
      Alert.alert('Hata', 'Misafirler için tarif oluşturulamadı.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🏠 Misafir Modu</Text>
      <Text style={styles.subtitle}>Misafirlerinizin alerji ve diyet kısıtlamalarını ekleyin, herkese uygun ortak bir tarif bulalım.</Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="Misafir Adı (örn: Ayşe)"
          placeholderTextColor={colors.textMuted}
          value={guestName}
          onChangeText={setGuestName}
        />
        <TextInput
          style={styles.input}
          placeholder="Kısıtlama (örn: Vegan, Fıstık Alerjisi)"
          placeholderTextColor={colors.textMuted}
          value={restriction}
          onChangeText={setRestriction}
        />
        <TouchableOpacity style={styles.addButton} onPress={handleAddGuest}>
          <Text style={styles.addButtonText}>Ekle</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.guestsList}>
        {guests.map((g, index) => (
          <View key={index} style={styles.guestCard}>
            <View>
              <Text style={styles.guestName}>{g.name}</Text>
              <Text style={styles.guestRestriction}>{g.restrictions.join(', ')}</Text>
            </View>
            <TouchableOpacity onPress={() => handleRemoveGuest(index)}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        ))}
      </View>

      <TouchableOpacity
        style={[styles.generateButton, (guests.length === 0 || loading) && styles.disabledButton]}
        onPress={handleGenerate}
        disabled={guests.length === 0 || loading}
      >
        <LinearGradient colors={[colors.gradientStart, colors.gradientEnd]} style={styles.generateGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
          {loading ? <ActivityIndicator color="white" /> : <Text style={styles.generateButtonText}>Tarif Bul</Text>}
        </LinearGradient>
      </TouchableOpacity>
    </ScrollView>
  );
}

const getStyles = (colors: AppThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: Spacing.xl, paddingTop: 60, paddingBottom: 100 },
  title: { fontSize: Typography['2xl'], fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
  subtitle: { fontSize: Typography.sm, color: colors.textSecondary, marginBottom: Spacing['2xl'], lineHeight: 20 },
  inputContainer: { backgroundColor: colors.surface, padding: Spacing.base, borderRadius: Radius.lg, gap: 12, ...Shadow.sm, marginBottom: Spacing.xl },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: 12, fontSize: Typography.base, color: colors.textPrimary },
  addButton: { backgroundColor: colors.primary, padding: 12, borderRadius: Radius.md, alignItems: 'center' },
  addButtonText: { color: colors.white, fontWeight: '700', fontSize: Typography.base },
  guestsList: { gap: 10, marginBottom: Spacing['2xl'] },
  guestCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: Radius.md, borderWidth: 1, borderColor: colors.border },
  guestName: { fontSize: Typography.base, fontWeight: '700', color: colors.textPrimary },
  guestRestriction: { fontSize: Typography.sm, color: colors.textSecondary, marginTop: 4 },
  generateButton: { borderRadius: Radius.lg, overflow: 'hidden', ...Shadow.md },
  disabledButton: { opacity: 0.5 },
  generateGradient: { padding: 16, alignItems: 'center' },
  generateButtonText: { color: colors.white, fontWeight: '800', fontSize: Typography.lg },
});
