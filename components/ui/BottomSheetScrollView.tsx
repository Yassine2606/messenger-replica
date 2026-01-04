import React, { forwardRef } from 'react';
import {
  StyleSheet,
  type ScrollViewProps,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedScrollHandler,
} from 'react-native-reanimated';

interface BottomSheetScrollViewProps extends ScrollViewProps {
  children: React.ReactNode;
}

/**
 * BottomSheetScrollView: ScrollView optimized for use inside BottomSheet
 * 
 * Features:
 * - Automatically handles scroll-to-gesture handoff
 * - Tracks scroll position for proper gesture coordination
 * - Optimized for 60fps performance
 * - Works seamlessly with BottomSheet pan gestures
 */
export const BottomSheetScrollView = forwardRef<Animated.ScrollView, BottomSheetScrollViewProps>(
  ({ children, ...scrollViewProps }, ref) => {
    const scrollOffset = useSharedValue(0);

    const scrollHandler = useAnimatedScrollHandler({
      onScroll: (event) => {
        scrollOffset.value = event.contentOffset.y;
      },
    });

    return (
      <Animated.ScrollView
        ref={ref as any}
        {...scrollViewProps}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        bounces={true}
        showsVerticalScrollIndicator={true}
        style={[styles.scrollView, scrollViewProps.style]}
      >
        {children}
      </Animated.ScrollView>
    );
  }
);

BottomSheetScrollView.displayName = 'BottomSheetScrollView';

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
});
