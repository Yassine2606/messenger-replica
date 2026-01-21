import { View, Text } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useEffect, useRef } from 'react';
import React from 'react';
import { useSocket, useTheme } from '@/contexts';

function SocketConnectionStatusComponent() {
  const { isConnected } = useSocket();
  const { colors } = useTheme();
  const opacity = useSharedValue(0);
  const height = useSharedValue(0);
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Skip animation on initial mount
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!isConnected) {
      // Show the disconnected status
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      height.value = withTiming(28, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
    } else {
      // Show the connected status, then hide after 2 seconds
      opacity.value = withTiming(1, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });
      height.value = withTiming(28, {
        duration: 300,
        easing: Easing.inOut(Easing.ease),
      });

      const timer = setTimeout(() => {
        opacity.value = withTiming(0, {
          duration: 300,
          easing: Easing.inOut(Easing.ease),
        });
        height.value = withTiming(0, {
          duration: 300,
          easing: Easing.inOut(Easing.ease),
        });
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [isConnected, opacity, height]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    height: height.value,
  }));

  return (
    <Animated.View style={animatedStyle} className="overflow-hidden">
      <View
        style={{
          backgroundColor: isConnected ? colors.success : colors.error,
        }}
        className="items-center justify-center py-1">
        <Text style={{ color: colors.text.inverted }} className="text-xs font-medium">
          {isConnected ? '● Connected' : '● Disconnected'}
        </Text>
      </View>
    </Animated.View>
  );
}

export const SocketConnectionStatus = React.memo(SocketConnectionStatusComponent);
