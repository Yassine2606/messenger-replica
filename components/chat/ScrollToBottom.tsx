import { memo } from 'react';
import { TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withTiming,
  useDerivedValue,
  interpolate,
} from 'react-native-reanimated';

interface ScrollToBottomProps {
  visible: boolean;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScrollToBottomComponent({ visible, onPress }: ScrollToBottomProps) {
  const animatedValue = useDerivedValue(() => withTiming(visible ? 1 : 0, { duration: 150 }));

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(animatedValue.value, [0, 1], [60, 0]) }],
  }));

  return (
    <Animated.View
      style={[
        animatedStyle,
        {
          alignItems: 'center',
          pointerEvents: visible ? 'auto' : 'none',
        },
      ]}>
      <AnimatedTouchable
        onPress={onPress}
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: '#3B82F6',
          justifyContent: 'center',
          alignItems: 'center',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 4,
          elevation: 4,
        }}
        activeOpacity={0.8}>
        <Ionicons name="arrow-down" size={24} color="white" />
      </AnimatedTouchable>
    </Animated.View>
  );
}

export const ScrollToBottom = memo(ScrollToBottomComponent);
