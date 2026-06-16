import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Dimensions, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Colors, Radius, Typography } from '../constants/Colors';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');

export default function StoryScreen() {
  const { recipeName, stepsJson } = useLocalSearchParams<{ recipeName: string; stepsJson: string }>();
  const router = useRouter();

  const steps: string[] = stepsJson ? JSON.parse(stepsJson) : [];
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  const progress = useRef(new Animated.Value(0)).current;

  // Each step lasts 8 seconds
  const DURATION = 8000;

  useEffect(() => {
    if (steps.length === 0) return;

    if (!isPaused) {
      Animated.timing(progress, {
        toValue: 1,
        duration: DURATION * (1 - (progress as any)._value),
        useNativeDriver: false,
      }).start(({ finished }) => {
        if (finished) {
          handleNext();
        }
      });
    } else {
      progress.stopAnimation();
    }
  }, [currentIndex, isPaused, steps.length]);

  const handleNext = () => {
    if (currentIndex < steps.length - 1) {
      progress.setValue(0);
      setCurrentIndex((prev) => prev + 1);
    } else {
      // Finished all stories
      router.back();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      progress.setValue(0);
      setCurrentIndex((prev) => prev - 1);
    } else {
      progress.setValue(0);
    }
  };

  const handlePressIn = () => {
    setIsPaused(true);
  };

  const handlePressOut = () => {
    setIsPaused(false);
  };

  if (!steps || steps.length === 0) return null;

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#1A1A2E', '#16213E']} style={StyleSheet.absoluteFillObject} />
      
      {/* Progress Bars */}
      <View style={styles.progressBarContainer}>
        {steps.map((_, index) => {
          let widthAnim;
          if (index < currentIndex) {
            widthAnim = '100%';
          } else if (index === currentIndex) {
            widthAnim = progress.interpolate({
              inputRange: [0, 1],
              outputRange: ['0%', '100%'],
            });
          } else {
            widthAnim = '0%';
          }

          return (
            <View key={index} style={styles.progressBarTrack}>
              <Animated.View style={[styles.progressBarFill, { width: widthAnim as any }]} />
            </View>
          );
        })}
      </View>

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="restaurant" size={24} color={Colors.white} />
          <Text style={styles.headerTitle} numberOfLines={1}>{recipeName}</Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={() => router.back()}>
          <Ionicons name="close" size={28} color={Colors.white} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepBadgeText}>Adım {currentIndex + 1} / {steps.length}</Text>
        </View>
        <Text style={styles.stepText}>{steps[currentIndex]}</Text>
      </View>

      {/* Touch Areas */}
      <View style={styles.touchAreaContainer}>
        <TouchableOpacity
          style={styles.touchArea}
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handlePrev}
        />
        <TouchableOpacity
          style={styles.touchArea}
          activeOpacity={1}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          onPress={handleNext}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  progressBarContainer: {
    flexDirection: 'row',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 10,
    gap: 4,
    zIndex: 10,
  },
  progressBarTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    zIndex: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  headerTitle: {
    color: Colors.white,
    fontSize: Typography.base,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
    zIndex: 5,
  },
  stepBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.full,
    marginBottom: 30,
  },
  stepBadgeText: {
    color: Colors.white,
    fontSize: Typography.sm,
    fontWeight: '800',
  },
  stepText: {
    color: Colors.white,
    fontSize: Typography['2xl'],
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 40,
  },
  touchAreaContainer: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 1,
  },
  touchArea: {
    flex: 1,
  },
});
