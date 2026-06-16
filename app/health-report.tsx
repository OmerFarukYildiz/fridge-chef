import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { AppThemeColors, Radius, Shadow, Spacing, Typography } from '../constants/Colors';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import { getDailyCalories, getWeeklyCalories } from '../services/firestoreService';

export default function HealthReportScreen() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = React.useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const [loading, setLoading] = useState(true);
  const [todayKcal, setTodayKcal] = useState(0);
  const [weeklyData, setWeeklyData] = useState<{day: string, total: number, progress: number}[]>([]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadData();
      }
    }, [user])
  );

  const loadData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const today = await getDailyCalories(user.uid);
      setTodayKcal(today);
      
      const weekly = await getWeeklyCalories(user.uid);
      const targetKcal = (userProfile as any)?.calorieGoal || 2000;
      
      // Pazartesi'den Pazar'a mevcut haftayı oluştur
      const days = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
      const currentWeekDays = [];
      const now = new Date();
      const currentDay = now.getDay(); // 0: Paz, 1: Pzt, ..., 6: Cmt
      const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
      const monday = new Date(now);
      monday.setDate(now.getDate() + distanceToMonday);

      for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        const key = d.toISOString().split('T')[0];
        const dayName = days[d.getDay()];
        
        const found = weekly.find(w => w.dateKey === key);
        const total = found ? found.total : 0;
        const progress = Math.min((total / targetKcal) * 100, 100);
        
        currentWeekDays.push({ day: dayName, total, progress });
      }
      setWeeklyData(currentWeekDays);
    } catch (err) {
      console.error('[HealthReport]', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const targetKcal = (userProfile as any)?.calorieGoal || 2000;
  const progress = Math.min((todayKcal / targetKcal) * 100, 100);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scrollContent}>
      <LinearGradient
        colors={[colors.secondary, colors.secondaryDark]}
        style={styles.headerCard}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
      >
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="white" />
        </TouchableOpacity>
        <Ionicons name="fitness" size={40} color="white" />
        <Text style={styles.headerTitle}>Haftalık Sağlık Raporu</Text>
        <Text style={styles.headerSub}>Beslenme ve hedef takibiniz</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Bugün</Text>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Alınan Kalori</Text>
          <Text style={styles.statValue}>{todayKcal} <Text style={styles.statUnit}>/ {targetKcal} kcal</Text></Text>
          
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Haftalık Özeti</Text>
        <View style={styles.weeklyCard}>
          {weeklyData.map((data, index) => (
            <View key={index} style={styles.weekRow}>
              <Text style={styles.dayText}>{data.day}</Text>
              <View style={styles.dayBarBg}>
                <View style={[styles.dayBarFill, { width: `${data.progress}%`, backgroundColor: data.progress >= 100 ? colors.error : colors.secondary }]} />
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Tavsiyeler</Text>
        <View style={styles.tipCard}>
          <Ionicons name="water-outline" size={24} color="#3B82F6" />
          <Text style={styles.tipText}>Su tüketimini artırmalısınız. Günde en az 2.5 litre su içmeye özen gösterin.</Text>
        </View>
        <View style={styles.tipCard}>
          <Ionicons name="leaf-outline" size={24} color="#10B981" />
          <Text style={styles.tipText}>Lifli gıdalar sindiriminizi düzenler. Haftalık raporunuzda sebze tüketiminiz düşük görünüyor.</Text>
        </View>
      </View>

    </ScrollView>
  );
}

const getStyles = (colors: AppThemeColors, isDark: boolean) => StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
  scrollContent: { padding: Spacing.xl, paddingBottom: 60 },
  
  headerCard: {
    padding: Spacing.xl,
    borderRadius: Radius.xl,
    alignItems: 'center',
    marginBottom: Spacing.xl,
    position: 'relative',
    ...Shadow.md,
  },
  backBtn: {
    position: 'absolute',
    top: Spacing.lg,
    left: Spacing.lg,
    padding: 4,
  },
  headerTitle: { fontSize: Typography.xl, fontWeight: '800', color: 'white', marginTop: 8 },
  headerSub: { fontSize: Typography.sm, color: 'rgba(255,255,255,0.8)' },
  
  section: { marginBottom: Spacing.xl },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '700', color: colors.textPrimary, marginBottom: Spacing.md },
  
  statCard: { backgroundColor: colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border },
  statLabel: { fontSize: Typography.sm, color: colors.textSecondary },
  statValue: { fontSize: Typography['3xl'], fontWeight: '800', color: colors.primary, marginVertical: 8 },
  statUnit: { fontSize: Typography.base, color: colors.textMuted, fontWeight: '500' },
  progressBar: { height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.primary },
  
  weeklyCard: { backgroundColor: colors.surface, padding: Spacing.lg, borderRadius: Radius.lg, borderWidth: 1, borderColor: colors.border, gap: 12 },
  weekRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dayText: { width: 30, fontSize: Typography.sm, fontWeight: '600', color: colors.textSecondary },
  dayBarBg: { flex: 1, height: 12, backgroundColor: colors.border, borderRadius: 6, overflow: 'hidden' },
  dayBarFill: { height: '100%', backgroundColor: colors.secondary },
  
  tipCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface, padding: Spacing.base, borderRadius: Radius.lg, marginBottom: 8, borderWidth: 1, borderColor: colors.border },
  tipText: { flex: 1, fontSize: Typography.sm, color: colors.textPrimary, lineHeight: 20 },
});
