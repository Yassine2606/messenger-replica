import { memo, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming
} from 'react-native-reanimated';

interface ScrollToBottomProps {
  visible: boolean;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScrollToBottomComponent({ visible, onPress }: ScrollToBottomProps) {
  const translateY = useSharedValue(20);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    } else {
      opacity.value = withTiming(0, { duration: 150 });
      translateY.value = withTiming(20, { duration: 150 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  if (!visible) return null;

  return (
    <AnimatedTouchable
      onPress={onPress}
      style={[animatedStyle]}
      className="h-10 w-10 items-center justify-center rounded-full bg-blue-500 shadow-lg"
      activeOpacity={0.7}>
      <Ionicons name="arrow-down" size={24} color="white" />
    </AnimatedTouchable>
  );
}

export const ScrollToBottom = memo(ScrollToBottomComponent);
