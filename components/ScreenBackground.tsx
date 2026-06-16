import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface ScreenBackgroundProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
}

export default function ScreenBackground({ children, style }: ScreenBackgroundProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
  },
});
