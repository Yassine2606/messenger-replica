import React, { useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  Dimensions,
  Pressable,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Image } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Constants for gesture behavior
const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_THRESHOLD = 120;
const DISMISS_VELOCITY_THRESHOLD = 800;
const TIMING_CONFIG = { duration: 200 };

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
}

type ImageDimensions = { width: number; height: number };

/**
 * ImageViewer: Production-grade image modal with pinch zoom, double-tap zoom, and swipe-to-close
 * Features:
 * - Smooth pinch-to-zoom with focal point preservation
 * - Double-tap zoom at tap location
 * - Pan when zoomed with edge clamping
 * - Swipe-down to dismiss with backdrop fade
 * - Loading and error states
 * - Accessibility support
 */
export function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
  // State for image dimensions and loading
  const [imageSize, setImageSize] = React.useState<ImageDimensions>({ width: 0, height: 0 });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isError, setIsError] = React.useState(false);

  // Animated values for zoom and pan
  const scale = useSharedValue(MIN_SCALE);
  const savedScale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);
  const isPinching = useSharedValue(false);

  /**
   * Calculate image dimensions to fit screen while maintaining aspect ratio
   */
  const calculateImageDimensions = useCallback((width: number, height: number): ImageDimensions => {
    const imageAspect = width / height;
    const screenAspect = SCREEN_WIDTH / SCREEN_HEIGHT;

    if (imageAspect > screenAspect) {
      return {
        width: SCREEN_WIDTH,
        height: SCREEN_WIDTH / imageAspect,
      };
    }

    return {
      width: SCREEN_HEIGHT * imageAspect,
      height: SCREEN_HEIGHT,
    };
  }, []);

  /**
   * Load image dimensions on mount or when URI changes
   */
  useEffect(() => {
    if (!visible || !imageUri) return;

    setIsLoading(true);
    setIsError(false);

    Image.getSize(
      imageUri,
      (width, height) => {
        setImageSize(calculateImageDimensions(width, height));
        setIsLoading(false);
      },
      () => {
        setIsError(true);
        setIsLoading(false);
      }
    );
  }, [visible, imageUri, calculateImageDimensions]);

  /**
   * Reset all gesture state values
   */
  const resetGestureState = useCallback(() => {
    scale.value = withTiming(MIN_SCALE, TIMING_CONFIG);
    savedScale.value = MIN_SCALE;
    translateX.value = withTiming(0, TIMING_CONFIG);
    translateY.value = withTiming(0, TIMING_CONFIG);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    backdropOpacity.value = withTiming(1, TIMING_CONFIG);
  }, [scale, translateX, translateY, backdropOpacity]);

  /**
   * Close modal and reset state
   */
  const handleClose = useCallback(() => {
    resetGestureState();
    onClose();
  }, [resetGestureState, onClose]);

  /**
   * Pinch gesture: Zoom in/out with focal point preservation
   */
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      // Mark that we're pinching to prevent pan interference
      isPinching.value = true;
      // Save current state when pinch starts
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      // Scale is cumulative from gesture start
      const newScale = Math.min(Math.max(savedScale.value * event.scale, MIN_SCALE), MAX_SCALE);
      scale.value = newScale;

      // Get focal point relative to screen center
      const focalX = event.focalX - SCREEN_WIDTH / 2;
      const focalY = event.focalY - SCREEN_HEIGHT / 2;

      // Calculate how much we've scaled relative to saved state
      const scaleFactor = newScale / savedScale.value;

      // Keep focal point stationary: move image so pinch point stays under fingers
      translateX.value = focalX - (focalX - savedTranslateX.value) / scaleFactor;
      translateY.value = focalY - (focalY - savedTranslateY.value) / scaleFactor;
    })
    .onEnd(() => {
      // Update saved values for next gesture
      savedScale.value = scale.value;
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
      // Mark pinch as complete
      isPinching.value = false;

      // Snap back if barely zoomed
      if (scale.value < 1.1) {
        scale.value = withTiming(MIN_SCALE, TIMING_CONFIG);
        savedScale.value = MIN_SCALE;
        translateX.value = withTiming(0, TIMING_CONFIG);
        translateY.value = withTiming(0, TIMING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  /**
   * Pan gesture: Pan when zoomed, swipe down to dismiss
   */
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const isZoomed = scale.value > 1.1;

      if (isZoomed) {
        const newTranslateX = savedTranslateX.value + event.translationX;
        const newTranslateY = savedTranslateY.value + event.translationY;

        // Clamp translate values inline to prevent panning beyond image bounds
        const maxTranslateX = (imageSize.width * scale.value - SCREEN_WIDTH) / 2;
        const maxTranslateY = (imageSize.height * scale.value - SCREEN_HEIGHT) / 2;

        translateX.value = Math.min(Math.max(newTranslateX, -maxTranslateX), maxTranslateX);
        translateY.value = Math.min(Math.max(newTranslateY, -maxTranslateY), maxTranslateY);
      } else if (!isPinching.value) {
        // Only allow swipe-to-dismiss if not currently pinching
        if (event.translationY > 0) {
          translateY.value = event.translationY;
          const progress = Math.min(event.translationY / SCREEN_HEIGHT, 1);
          backdropOpacity.value = 1 - progress * 0.7;
        }
      }
    })
    .onEnd((event) => {
      const isZoomed = scale.value > 1.1;

      if (isZoomed) {
        savedTranslateX.value = translateX.value;
        savedTranslateY.value = translateY.value;
      } else {
        const shouldDismiss =
          translateY.value > DISMISS_THRESHOLD || event.velocityY > DISMISS_VELOCITY_THRESHOLD;

        if (shouldDismiss) {
          translateY.value = withTiming(SCREEN_HEIGHT, TIMING_CONFIG);
          backdropOpacity.value = withTiming(0, TIMING_CONFIG);
          runOnJS(handleClose)();
        } else {
          translateY.value = withTiming(0, TIMING_CONFIG);
          backdropOpacity.value = withTiming(1, TIMING_CONFIG);
        }
      }
    });

  /**
   * Double-tap gesture: Zoom to tap location or zoom out
   */
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1.1) {
        // Already zoomed, zoom out
        scale.value = withTiming(MIN_SCALE, TIMING_CONFIG);
        savedScale.value = MIN_SCALE;
        translateX.value = withTiming(0, TIMING_CONFIG);
        translateY.value = withTiming(0, TIMING_CONFIG);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in at tap location
        const tapX = event.x - SCREEN_WIDTH / 2;
        const tapY = event.y - SCREEN_HEIGHT / 2;

        scale.value = withTiming(DOUBLE_TAP_SCALE, TIMING_CONFIG);
        savedScale.value = DOUBLE_TAP_SCALE;
        translateX.value = withTiming(-tapX * (DOUBLE_TAP_SCALE - 1), TIMING_CONFIG);
        translateY.value = withTiming(-tapY * (DOUBLE_TAP_SCALE - 1), TIMING_CONFIG);
        savedTranslateX.value = -tapX * (DOUBLE_TAP_SCALE - 1);
        savedTranslateY.value = -tapY * (DOUBLE_TAP_SCALE - 1);
      }
    });

  /**
   * Compose gestures: pinch + pan simultaneously, double-tap separately
   */
  const composedGesture = Gesture.Simultaneous(
    Gesture.Simultaneous(pinchGesture, panGesture),
    doubleTapGesture
  );

  // Animated styles
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
      accessibilityRole="image"
      accessibilityLabel="Full screen image viewer">
      <GestureHandlerRootView style={styles.gestureRoot}>
        <StatusBar hidden />

        <View style={styles.container}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />

          {/* Close button */}
          <View style={styles.header}>
            <Pressable
              onPress={handleClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
              accessibilityHint="Double tap to close">
              <Ionicons name="close" size={24} color="white" />
            </Pressable>
          </View>

          {/* Image with gestures */}
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={styles.imageContainer} accessible={false}>
              {isLoading && (
                <ActivityIndicator
                  size="large"
                  color="white"
                  style={styles.loader}
                  accessibilityLabel="Loading image"
                />
              )}

              {isError && (
                <View style={styles.errorContainer} accessible={true} accessibilityLabel="Failed to load image">
                  <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.5)" />
                </View>
              )}

              {!isLoading && !isError && (
                <Animated.Image
                  source={{ uri: imageUri }}
                  style={[
                    {
                      width: imageSize.width,
                      height: imageSize.height,
                    },
                    animatedImageStyle,
                  ]}
                  resizeMode="contain"
                  accessible={true}
                  accessibilityRole="image"
                />
              )}
            </Animated.View>
          </GestureDetector>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 12,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    borderRadius: 22,
  },
  imageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loader: {
    position: 'absolute',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
