import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useTheme } from '@/contexts';

interface TypingIndicatorProps {
  userName?: string;
  visible: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function TypingIndicator({ userName, visible }: TypingIndicatorProps) {
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const height = useSharedValue(visible ? 1 : 0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 150 });
      height.value = withTiming(1, { duration: 150 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      height.value = withTiming(0, { duration: 150 });
    }
  }, [visible, opacity, height]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: height.value > 0.5 ? 'auto' : 0,
    overflow: 'hidden',
  }));

  const getDotOpacity = (index: number) => {
    const values = [0.4, 0.7, 1.0];
    return values[index];
  };

  const styles = StyleSheet.create({
    container: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.bg.secondary,
      borderTopWidth: 1,
      borderTopColor: colors.border.primary,
    },
    label: {
      fontSize: 13,
      color: colors.text.secondary,
      fontWeight: '500',
    },
    dotsContainer: {
      flexDirection: 'row',
      gap: 4,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.primary,
    },
  });

  return (
    <AnimatedView style={[containerStyle, { pointerEvents: visible ? 'auto' : 'none' }]}>
      <View style={styles.container}>
        <Text style={styles.label}>{userName || 'User'} is typing</Text>
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.dot, { opacity: getDotOpacity(i) }]} />
          ))}
        </View>
      </View>
    </AnimatedView>
  );
}
