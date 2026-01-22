import { useCallback, useState, useRef } from 'react';
import { FlatList } from 'react-native';
import {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import { Message } from '@/models';

/**
 * Manages scroll button visibility and animations
 * Shows button when not at bottom of list
 */
export function useChatScrollButton(isTypingIndicatorVisible: boolean) {
  const flatListRef = useRef<FlatList<Message>>(null);
  const [buttonVisible, setButtonVisible] = useState(false);
  const shouldShowButton = useSharedValue(0);

  useAnimatedReaction(
    () => shouldShowButton.value,
    (value) => {
      runOnJS(setButtonVisible)(value > 0.5 && !isTypingIndicatorVisible);
    }
  );

  const handleScroll = useCallback(
    (e: any) => {
      const contentOffsetY = e.nativeEvent.contentOffset.y;
      // With inverted list, check if we're at the bottom (near newest messages)
      const isAtBottom = contentOffsetY <= 100;
      shouldShowButton.value = isAtBottom ? 0 : 1;
    },
    [shouldShowButton]
  );

  const showScrollButtonStyle = useAnimatedStyle(() => ({
    pointerEvents: shouldShowButton.value > 0.5 ? 'auto' : 'none',
  }));

  const scrollToBottom = useCallback(() => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, []);

  return {
    flatListRef,
    buttonVisible,
    handleScroll,
    showScrollButtonStyle,
    scrollToBottom,
    shouldShowButton,
  };
}
