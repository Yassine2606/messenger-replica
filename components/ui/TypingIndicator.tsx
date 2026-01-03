import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  withDelay,
} from 'react-native-reanimated';

interface TypingIndicatorProps {
  userName?: string;
  visible: boolean;
}

export function TypingIndicator({ userName, visible }: TypingIndicatorProps) {
  const opacity = useSharedValue(0);
  const dot1Scale = useSharedValue(0.8);
  const dot2Scale = useSharedValue(0.8);
  const dot3Scale = useSharedValue(0.8);

  useEffect(() => {
    if (visible) {
      // Fade in
      opacity.value = withTiming(1, { duration: 200 });

      // Animated dots
      dot1Scale.value = withRepeat(
        withSequence(
          withTiming(1.2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: 400, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        false
      );

      dot2Scale.value = withDelay(
        150,
        withRepeat(
          withSequence(
            withTiming(1.2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.8, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      );

      dot3Scale.value = withDelay(
        300,
        withRepeat(
          withSequence(
            withTiming(1.2, { duration: 400, easing: Easing.inOut(Easing.ease) }),
            withTiming(0.8, { duration: 400, easing: Easing.inOut(Easing.ease) })
          ),
          -1,
          false
        )
      );
    } else {
      // Fade out
      opacity.value = withTiming(0, { duration: 200 });
      // Reset dots
      dot1Scale.value = 0.8;
      dot2Scale.value = 0.8;
      dot3Scale.value = 0.8;
    }
  }, [visible]);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const dot1Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot1Scale.value }],
  }));

  const dot2Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot2Scale.value }],
  }));

  const dot3Style = useAnimatedStyle(() => ({
    transform: [{ scale: dot3Scale.value }],
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, containerStyle]}>
      <View style={styles.bubble}>
        <View style={styles.dotsContainer}>
          <Animated.View style={[styles.dot, dot1Style]} />
          <Animated.View style={[styles.dot, dot2Style]} />
          <Animated.View style={[styles.dot, dot3Style]} />
        </View>
      </View>
      {userName && (
        <Text style={styles.label}>{userName} is typing</Text>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bubble: {
    backgroundColor: '#F3F4F6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#9CA3AF',
  },
  label: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
});
