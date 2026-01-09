import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Pressable, Text, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import type { Message } from '@/models';

interface AudioWavePlayerProps {
  audioUrl: string;
  waveform: number[]; // Normalized 0-1 array
  duration: number; // milliseconds
  isOwn?: boolean; // Whether this is the current user's message
  message?: Message; // Message object for context menu
  onPlaybackStatusUpdate?: (isPlaying: boolean, position: number) => void;
  onContextMenu?: (message: Message) => void;
}

/**
 * Memoized static waveform bar component
 * Renders once and doesn't re-render during playback
 */
const WaveformBar = React.memo(
  ({
    amplitude,
    barWidth,
    barColor,
    index,
  }: {
    amplitude: number;
    barWidth: number;
    barColor: string;
    index: number;
  }) => {
    const heightPercent = Math.max(5, Math.min(100, amplitude * 100));
    return (
      <View
        key={index}
        style={{
          width: barWidth,
          height: `${heightPercent}%`,
          backgroundColor: barColor,
          marginRight: 1,
          borderRadius: 2,
        }}
      />
    );
  },
  // Custom comparison to prevent re-renders (all props are stable)
  () => true
);

WaveformBar.displayName = 'WaveformBar';

/**
 * AudioWavePlayer: Modern audio message player with smooth playback indicator
 * 
 * Features:
 * - Static waveform visualization (no ScrollView)
 * - Smooth horizontal playback indicator bar
 * - Time-based animation with interpolation
 * - Optimized with React.memo and stable memoization
 * - No re-renders during playback
 */
export const AudioWavePlayer = React.memo(function AudioWavePlayer({
  audioUrl,
  waveform,
  duration,
  isOwn = false,
  message,
  onPlaybackStatusUpdate,
  onContextMenu,
}: AudioWavePlayerProps) {
  const player = useAudioPlayer({ uri: audioUrl }, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);
  
  // Shared values for smooth continuous animation
  const playbackProgress = useSharedValue(0);
  const containerWidth = useSharedValue(240); // Use shared value instead of ref
  const playbackStartTimeRef = useRef<number | null>(null);
  const playbackStartPositionRef = useRef(0);

  // Configure audio mode for iOS speaker playback
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      // Silently fail on web/unsupported platforms
    });
  }, []);

  // Handle container width measurement
  const handleContainerLayout = useCallback((event: LayoutChangeEvent) => {
    containerWidth.value = Math.max(100, event.nativeEvent.layout.width - 16); // Subtract padding
  }, [containerWidth]);

  // Detect play state changes and start/stop continuous animation
  useAnimatedReaction(
    () => status.playing,
    (isPlaying) => {
      if (isPlaying && status.isLoaded && status.duration > 0) {
        // Start continuous smooth animation
        const currentProgress = status.currentTime / status.duration;
        const remainingTime = Math.max(0, (1 - currentProgress) * status.duration * 1000);
        
        // Animate from current position to end with smooth easing
        playbackProgress.value = withTiming(1, {
          duration: remainingTime,
          easing: Easing.linear,
        });
      }
    }
  );

  // Update when seek or pause happens
  useEffect(() => {
    if (!status.isLoaded || status.duration === 0) return;

    const currentProgress = status.currentTime / status.duration;

    if (status.playing) {
      // Already handled by useAnimatedReaction above
    } else {
      // Paused: update to current position without animation
      playbackProgress.value = currentProgress;
    }
  }, [status.currentTime, status.playing, status.isLoaded, status.duration, playbackProgress]);

  // Replay: When audio finishes, reset to beginning
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
      playbackProgress.value = 0;
    }
  }, [status.didJustFinish, player, playbackProgress]);

  // Notify parent of playback updates
  useEffect(() => {
    if (status.isLoaded) {
      onPlaybackStatusUpdate?.(status.playing, status.currentTime * 1000);
    }
  }, [status.playing, status.currentTime, status.isLoaded, onPlaybackStatusUpdate]);

  // Animated style for smooth horizontal indicator bar
  const indicatorStyle = useAnimatedStyle(() => {
    const translateX = playbackProgress.value * containerWidth.value;
    return {
      transform: [{ translateX }],
    };
  });

  const handlePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [status.playing, player]);

  const handleLongPress = useCallback(() => {
    if (!message) return;

    // Provide haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
      // Silently fail on unsupported platforms
    });

    // Open context menu
    onContextMenu?.(message);
  }, [message, onContextMenu]);

  // Long press gesture for context menu
  const audioLongPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(handleLongPress)();
    });

  const handleWaveformPress = useCallback(
    (event: any) => {
      if (!duration || !status.isLoaded) return;

      const { locationX } = event.nativeEvent;
      const currentContainerWidth = containerWidth.value;
      const progress = Math.max(0, Math.min(1, locationX / currentContainerWidth));
      const seekTime = progress * (duration / 1000);

      // Immediately update indicator on seek
      playbackProgress.value = progress;
      player.seekTo(seekTime);
    },
    [duration, player, playbackProgress, status.isLoaded, containerWidth]
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  // Memoized computed values (calculated once)
  const durationSeconds = useMemo(() => duration / 1000, [duration]);
  const barColor = useMemo(() => (isOwn ? '#3B82F6' : '#6B7280'), [isOwn]);
  const bgColor = useMemo(() => (isOwn ? '#EFF6FF' : '#F3F4F6'), [isOwn]);
  const indicatorColor = useMemo(() => (isOwn ? '#3B82F6' : '#374151'), [isOwn]);
  
  // Consistent bar width (3px) with 1px spacing
  const barWidth = useMemo(() => 3, []);

  const formattedDuration = useMemo(
    () => formatTime(durationSeconds),
    [durationSeconds, formatTime]
  );

  // Precompute waveform bars once (stable reference)
  const waveformBars = useMemo(() => {
    if (!waveform || waveform.length === 0) {
      // Fallback: empty state bars
      return Array.from({ length: 30 }, (_, i) => (
        <View
          key={`fallback-${i}`}
          style={{
            width: 6,
            height: '30%',
            backgroundColor: '#D1D5DB',
            marginRight: 1,
            borderRadius: 2,
          }}
        />
      ));
    }

    return waveform.map((amplitude, index) => (
      <WaveformBar
        key={`bar-${index}`}
        amplitude={amplitude}
        barWidth={barWidth}
        barColor={barColor}
        index={index}
      />
    ));
  }, [waveform, barWidth, barColor]);

  return (
    <GestureDetector gesture={audioLongPressGesture}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          borderRadius: 8,
          backgroundColor: bgColor,
          paddingHorizontal: 12,
          paddingVertical: 8,
          width: 280,
        }}
      >
      {/* Play/Pause Button */}
      <Pressable
        onPress={handlePlayPause}
        disabled={!status.isLoaded}
        style={{
          width: 32,
          height: 32,
          borderRadius: 16,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Ionicons
          name={
            !status.isLoaded ? 'hourglass-outline' : status.playing ? 'pause' : 'play'
          }
          size={16}
          color={!status.isLoaded ? '#999' : barColor}
        />
      </Pressable>

      {/* Waveform Container - Responsive width, respects FlatList bounds */}
      <Pressable
        onPress={handleWaveformPress}
        onLayout={handleContainerLayout}
        style={{
          flex: 1,
          height: 40,
          borderRadius: 6,
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'transparent',
          minWidth: 100,
        }}>
        {/* Static Waveform Visualization */}
        <View
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            paddingVertical: 4,
            paddingHorizontal: 2,
            flexDirection: 'row',
            alignItems: 'flex-end',
            justifyContent: 'flex-start',
          }}>
          {waveformBars}
        </View>

        {/* Smooth Horizontal Playback Indicator Bar */}
        <Animated.View
          style={[
            {
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 3,
              backgroundColor: indicatorColor,
              borderRadius: 1.5,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
              elevation: 3,
            },
            indicatorStyle,
          ]}
        />
      </Pressable>

      {/* Duration Display */}
      <Text
        style={{
          width: 40,
          textAlign: 'right',
          fontSize: 12,
          color: '#6B7280',
        }}>
        {formattedDuration}
      </Text>
      </View>
    </GestureDetector>
  );
});
