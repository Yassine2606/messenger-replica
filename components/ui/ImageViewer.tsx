import React, { useEffect } from 'react';
import { Modal, View, StyleSheet, Dimensions, Pressable, ActivityIndicator, StatusBar } from 'react-native';
import { Image } from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import { runOnJS } from 'react-native-worklets';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const DOUBLE_TAP_SCALE = 2.5;
const DISMISS_THRESHOLD = 100;
const DISMISS_VELOCITY_THRESHOLD = 500;

interface ImageViewerProps {
  visible: boolean;
  imageUri: string;
  onClose: () => void;
}

export function ImageViewer({ visible, imageUri, onClose }: ImageViewerProps) {
  // Image dimensions state
  const [imageSize, setImageSize] = React.useState({ width: 0, height: 0 });
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  // Gesture values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);
  const focalX = useSharedValue(0);
  const focalY = useSharedValue(0);
  const backdropOpacity = useSharedValue(1);

  // Load image dimensions
  useEffect(() => {
    if (visible && imageUri) {
      setLoading(true);
      setError(false);
      
      Image.getSize(
        imageUri,
        (width, height) => {
          const imageAspect = width / height;
          const screenAspect = SCREEN_WIDTH / SCREEN_HEIGHT;
          
          let finalWidth = SCREEN_WIDTH;
          let finalHeight = SCREEN_HEIGHT;
          
          if (imageAspect > screenAspect) {
            finalHeight = SCREEN_WIDTH / imageAspect;
          } else {
            finalWidth = SCREEN_HEIGHT * imageAspect;
          }
          
          setImageSize({ width: finalWidth, height: finalHeight });
          setLoading(false);
        },
        () => {
          setError(true);
          setLoading(false);
        }
      );
    }
  }, [visible, imageUri]);

  // Reset on close
  const resetState = () => {
    scale.value = withTiming(1);
    savedScale.value = 1;
    translateX.value = withTiming(0);
    translateY.value = withTiming(0);
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
    backdropOpacity.value = withTiming(1);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onStart(() => {
      focalX.value = 0;
      focalY.value = 0;
    })
    .onUpdate((event) => {
      const newScale = savedScale.value * event.scale;
      scale.value = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);
      
      // Adjust focal point
      focalX.value = event.focalX - SCREEN_WIDTH / 2;
      focalY.value = event.focalY - SCREEN_HEIGHT / 2;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      
      if (scale.value < 1.1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture (for panning when zoomed or dismissing)
  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      const isZoomed = scale.value > 1.1;
      
      if (isZoomed) {
        // Pan when zoomed - with edge clamping
        const maxTranslateX = ((imageSize.width * scale.value) - SCREEN_WIDTH) / 2;
        const maxTranslateY = ((imageSize.height * scale.value) - SCREEN_HEIGHT) / 2;
        
        const newTranslateX = savedTranslateX.value + event.translationX;
        const newTranslateY = savedTranslateY.value + event.translationY;
        
        translateX.value = Math.min(Math.max(newTranslateX, -maxTranslateX), maxTranslateX);
        translateY.value = Math.min(Math.max(newTranslateY, -maxTranslateY), maxTranslateY);
      } else {
        // Swipe down to dismiss
        if (event.translationY > 0) {
          translateY.value = event.translationY;
          
          // Fade backdrop based on drag distance
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
        // Check if should dismiss
        const shouldDismiss =
          translateY.value > DISMISS_THRESHOLD ||
          event.velocityY > DISMISS_VELOCITY_THRESHOLD;
        
        if (shouldDismiss) {
          translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
          backdropOpacity.value = withTiming(0, { duration: 200 });
          runOnJS(handleClose)();
        } else {
          translateY.value = withSpring(0);
          backdropOpacity.value = withSpring(1);
        }
      }
    });

  // Double tap gesture
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1.1) {
        // Zoom out
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to tap location
        const targetScale = DOUBLE_TAP_SCALE;
        
        // Calculate focal point relative to center
        const tapX = event.x - SCREEN_WIDTH / 2;
        const tapY = event.y - SCREEN_HEIGHT / 2;
        
        scale.value = withSpring(targetScale);
        savedScale.value = targetScale;
        
        // Pan to center the tapped point
        translateX.value = withSpring(-tapX * (targetScale - 1));
        translateY.value = withSpring(-tapY * (targetScale - 1));
        savedTranslateX.value = -tapX * (targetScale - 1);
        savedTranslateY.value = -tapY * (targetScale - 1);
      }
    });

  // Compose gestures
  const composedGesture = Gesture.Race(
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
      onRequestClose={handleClose}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar hidden />
        
        <View style={styles.container}>
          {/* Backdrop */}
          <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
          
          {/* Close button */}
          <View style={styles.header}>
            <Pressable onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={32} color="white" />
            </Pressable>
          </View>

          {/* Image with gestures */}
          <GestureDetector gesture={composedGesture}>
            <Animated.View style={styles.imageContainer}>
              {loading && (
                <ActivityIndicator size="large" color="white" style={styles.loader} />
              )}
              
              {error && (
                <View style={styles.errorContainer}>
                  <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.5)" />
                </View>
              )}
              
              {!loading && !error && (
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
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'black',
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 50,
    paddingHorizontal: 16,
  },
  closeButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
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
