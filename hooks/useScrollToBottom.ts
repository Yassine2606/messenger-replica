import { useCallback, useRef, useState } from 'react';
import { FlatList } from 'react-native';

const SCROLL_THRESHOLD = 50;
const SCROLL_ANIMATION_DURATION = 300;

/**
 * Hook for managing scroll-to-bottom button visibility and functionality
 * Handles debouncing, animation timing, and prevents race conditions
 */
export function useScrollToBottom(flatListRef: React.RefObject<FlatList<any> | null>) {
  const [showButton, setShowButton] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isAnimatingRef = useRef(false);

  const handleScroll = useCallback(
    ({ nativeEvent }: any) => {
      // Don't update state while animating to prevent race conditions
      if (isAnimatingRef.current) {
        return;
      }

      const { contentOffset } = nativeEvent;
      const isNearBottom = contentOffset.y < SCROLL_THRESHOLD;

      setShowButton(!isNearBottom);
    },
    []
  );

  const scrollToBottom = useCallback(() => {
    // Prevent rapid re-triggering
    if (isAnimatingRef.current) {
      return;
    }

    isAnimatingRef.current = true;
    setShowButton(false);

    // Perform the scroll
    flatListRef.current?.scrollToOffset({
      offset: 0,
      animated: true,
    });

    // Re-enable scroll detection after animation completes
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      isAnimatingRef.current = false;
    }, SCROLL_ANIMATION_DURATION);
  }, [flatListRef]);

  // Cleanup timeouts on unmount
  const cleanup = useCallback(() => {
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  return {
    showButton,
    handleScroll,
    scrollToBottom,
    cleanup,
  };
}
