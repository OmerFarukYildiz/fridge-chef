// ============================================================
// Fridge Chef — Renk Paleti ve Tasarım Sabitleri
// ============================================================

export const Colors = {
  // Ana renkler
  primary: '#FF8C00',       // Sıcak Turuncu
  primaryLight: '#FFB347',  // Açık Turuncu
  primaryDark: '#E67E00',   // Koyu Turuncu

  secondary: '#4CAF50',     // Taze Yeşil
  secondaryLight: '#81C784',
  secondaryDark: '#388E3C',

  // Arka planlar
  background: '#F9F6F2',    // Kırık beyaz/krem
  surface: '#FFFFFF',       // Kart yüzeyi
  surfaceElevated: '#FFF8F0', // Hafif turuncu tintli yüzey

  // Metin
  textPrimary: '#1A1A2E',   // Koyu lacivert
  textSecondary: '#6B7280', // Gri
  textMuted: '#9CA3AF',

  // Durum renkleri
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#4CAF50',
  warning: '#F59E0B',
  info: '#3B82F6',

  // Nötr
  border: '#E5E7EB',
  divider: '#F3F4F6',
  white: '#FFFFFF',
  black: '#000000',

  // Gradient başlangıç/bitiş
  gradientStart: '#FF8C00',
  gradientEnd: '#FF5F00',

  // Overlay
  overlay: 'rgba(0, 0, 0, 0.5)',
  overlayLight: 'rgba(0, 0, 0, 0.2)',
} as const;

export type ColorKey = keyof typeof Colors;

// Tipografi ölçeği
export const Typography = {
  xs: 12,
  sm: 14,
  base: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 36,
} as const;

// Boşluk ölçeği
export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
  '4xl': 48,
} as const;

// Border radius
export const Radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  full: 9999,
} as const;

// Gölge (iOS + Android uyumlu)
export const Shadow = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
} as const;
