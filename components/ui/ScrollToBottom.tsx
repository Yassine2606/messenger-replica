import { memo, useEffect } from 'react';
import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
} from 'react-native-reanimated';

interface ScrollToBottomProps {
  visible: boolean;
  onPress: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

function ScrollToBottomComponent({ visible, onPress }: ScrollToBottomProps) {
  const insets = useSafeAreaInsets();
  const combined = useSharedValue(0);

  useEffect(() => {
    combined.value = withTiming(visible ? 1 : 0, { duration: 120 });
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: combined.value,
    transform: [{ translateY: combined.value === 0 ? 60 : 0 }],
  }));


  return (
    <Animated.View
      style={[
        animatedStyle,
        { 
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: 'center',
          pointerEvents: visible ? 'auto' : 'none',
        }
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
