import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';

interface TypingIndicatorProps {
  userName?: string;
  visible: boolean;
}

const AnimatedView = Animated.createAnimatedComponent(View);

export function TypingIndicator({ userName, visible }: TypingIndicatorProps) {
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

  // Static dot opacity pattern (no complex animations)
  const getDotOpacity = (index: number) => {
    const values = [0.4, 0.7, 1.0];
    return values[index];
  };

  return (
    <AnimatedView style={[containerStyle, { pointerEvents: visible ? 'auto' : 'none' }]}>
      <View style={styles.container}>
        <Text style={styles.label}>{userName || 'User'} is typing</Text>
        <View style={styles.dotsContainer}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { opacity: getDotOpacity(i) },
              ]}
            />
          ))}
        </View>
      </View>
    </AnimatedView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
  },
  label: {
    fontSize: 13,
    color: '#6B7280',
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
    backgroundColor: '#3B82F6',
  },
});
