import { memo, useEffect } from 'react';
import { TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  Easing
} from 'react-native-reanimated';

interface ScrollToBottomProps {
  visible: boolean;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScrollToBottomComponent({ visible, onPress }: ScrollToBottomProps) {
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { 
        duration: 150, // Faster fade in
        easing: Easing.out(Easing.cubic)
      });
      translateY.value = withTiming(0, { 
        duration: 150, // Faster slide in
        easing: Easing.out(Easing.cubic)
      });
    } else {
      opacity.value = withTiming(0, { 
        duration: 100, // Faster fade out
        easing: Easing.in(Easing.cubic)
      });
      translateY.value = withTiming(60, { 
        duration: 100, // Faster slide out
        easing: Easing.in(Easing.cubic)
      });
    }
  }, [visible, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Position button above input area (ChatInputFooter) with safe area consideration
  const bottomOffset = Math.max(insets.bottom, 16) + 80; // 80px for input area, respect safe area

  return (
    <Animated.View
      style={[
        animatedStyle,
        { pointerEvents: visible ? 'auto' : 'none', bottom: bottomOffset }
      ]}
      className="absolute left-0 right-0 items-center">
      <AnimatedTouchable
        onPress={onPress}
        style={animatedStyle}
        className="h-11 w-11 items-center justify-center rounded-full bg-blue-500 shadow-lg active:bg-blue-600"
        activeOpacity={0.8}>
        <Ionicons name="arrow-down" size={24} color="white" />
      </AnimatedTouchable>
    </Animated.View>
  );
}

export const ScrollToBottom = memo(ScrollToBottomComponent);
