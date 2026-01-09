import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import Svg, { Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';
import type { Message } from '@/models';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  waveform: number[]; // Normalized 0-1 array
  duration: number; // milliseconds
  isOwn?: boolean; // Whether this is the current user's message
  message?: Message; // Message object for context menu
  onContextMenu?: (message: Message) => void;
}

/**
 * SVG Waveform Visualization - renders audio waveform as smooth lines
 */
const SvgWaveform = React.memo(
  ({
    waveform,
    waveColor,
    height = 36,
  }: {
    waveform: number[];
    waveColor: string;
    height?: number;
  }) => {
    if (!waveform || waveform.length === 0) {
      return (
        <Svg width="100%" height={height}>
          {/* Placeholder waveform */}
          {Array.from({ length: 20 }).map((_, i) => (
            <Line
              key={`placeholder-${i}`}
              x1={i * 7 + 2}
              y1={height / 2}
              x2={i * 7 + 2}
              y2={height / 2 - 4}
              stroke={waveColor}
              strokeWidth="1.5"
              opacity="0.4"
            />
          ))}
        </Svg>
      );
    }

    // Create SVG line paths for waveform
    const centerY = height / 2;
    const maxAmplitude = Math.max(...waveform, 0.1) || 0.1;
    const barSpacing = 140 / Math.max(waveform.length, 20); // Fit to container width

    return (
      <Svg width="100%" height={height} preserveAspectRatio="none">
        {waveform.slice(0, 20).map((amplitude, i) => {
          const normalizedAmplitude = (amplitude / maxAmplitude) * (height / 2 - 2);
          const x = i * barSpacing + barSpacing / 2;
          return (
            <Line
              key={`wave-${i}`}
              x1={x}
              y1={centerY}
              x2={x}
              y2={centerY - Math.max(2, normalizedAmplitude)}
              stroke={waveColor}
              strokeWidth="2"
              strokeLinecap="round"
            />
          );
        })}
      </Svg>
    );
  }
);

SvgWaveform.displayName = 'SvgWaveform';

/**
 * VoiceMessagePlayer: Optimized voice message player matching design system
 *
 * Design: Blue background, play button, waveform visualization, timestamp
 * Performance: Memoized, no re-renders during playback, optimized for virtualized lists
 * Accessibility: Haptic feedback, long-press for context menu
 */
export const VoiceMessagePlayer = React.memo(function VoiceMessagePlayer({
  audioUrl,
  waveform,
  duration,
  isOwn = false,
  message,
  onContextMenu,
}: VoiceMessagePlayerProps) {
  const player = useAudioPlayer({ uri: audioUrl }, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  // Shared values for smooth continuous animation
  const playbackProgress = useSharedValue(0);
  const containerWidth = useSharedValue(140); // Waveform container width
  const playbackStartTimeRef = useRef<number | null>(null);

  // Configure audio mode for iOS speaker playback
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      // Silently fail on web/unsupported platforms
    });
  }, []);

  // Detect play state changes and animate progress
  useAnimatedReaction(
    () => status.playing,
    (isPlaying) => {
      if (isPlaying && status.isLoaded && status.duration > 0) {
        const currentProgress = status.currentTime / status.duration;
        const remainingTime = Math.max(0, (1 - currentProgress) * status.duration * 1000);

        playbackProgress.value = withTiming(1, {
          duration: remainingTime,
          easing: Easing.linear,
        });
      }
    }
  );

  // Update progress on seek or pause
  useEffect(() => {
    if (!status.isLoaded || status.duration === 0) return;

    const currentProgress = status.currentTime / status.duration;
    if (!status.playing) {
      playbackProgress.value = currentProgress;
    }
  }, [status.currentTime, status.playing, status.isLoaded, status.duration, playbackProgress]);

  // Reset when audio finishes
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      player.seekTo(0);
      playbackProgress.value = 0;
    }
  }, [status.didJustFinish, player, playbackProgress]);

  const handlePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [status.playing, player]);

  const handleLongPress = useCallback(() => {
    if (!message) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
      // Silently fail on unsupported platforms
    });

    onContextMenu?.(message);
  }, [message, onContextMenu]);

  const longPressGesture = Gesture.LongPress()
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

  // Memoized computed values
  const durationSeconds = useMemo(() => duration / 1000, [duration]);
  const bgColor = useMemo(() => (isOwn ? '#3B82F6' : '#DBEAFE'), [isOwn]);
  const waveColor = useMemo(() => (isOwn ? '#FFFFFF' : '#3B82F6'), [isOwn]);
  const playButtonColor = useMemo(() => (isOwn ? '#FFFFFF' : '#3B82F6'), [isOwn]);
  const textColor = useMemo(() => (isOwn ? '#FFFFFF' : '#1E40AF'), [isOwn]);

  const formattedDuration = useMemo(
    () => formatTime(durationSeconds),
    [durationSeconds, formatTime]
  );

  // Animated style for playback indicator
  const indicatorStyle = useAnimatedStyle(() => {
    const translateX = playbackProgress.value * containerWidth.value;
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <GestureDetector gesture={longPressGesture}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          borderRadius: 12,
          backgroundColor: bgColor,
          paddingHorizontal: 10,
          paddingVertical: 8,
          width: 260,
        }}
      >
        {/* Play/Pause Button */}
        <Pressable
          onPress={handlePlayPause}
          disabled={!status.isLoaded}
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.2)' : 'rgba(59, 130, 246, 0.1)',
          }}
        >
          <Ionicons
            name={
              !status.isLoaded ? 'hourglass-outline' : status.playing ? 'pause-sharp' : 'play-sharp'
            }
            size={18}
            color={playButtonColor}
          />
        </Pressable>

        {/* Waveform Container */}
        <Pressable
          onPress={handleWaveformPress}
          onLayout={(e) => {
            containerWidth.value = e.nativeEvent.layout.width - 4; // Subtract padding
          }}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
            backgroundColor: isOwn ? 'rgba(255, 255, 255, 0.15)' : 'rgba(59, 130, 246, 0.08)',
            paddingHorizontal: 2,
            justifyContent: 'center',
          }}
        >
          {/* SVG Waveform Visualization */}
          <SvgWaveform waveform={waveform} waveColor={waveColor} height={36} />

          {/* Playback Indicator */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: 2,
                backgroundColor: playButtonColor,
                borderRadius: 1,
              },
              indicatorStyle,
            ]}
          />
        </Pressable>

        {/* Duration */}
        <Text
          style={{
            fontSize: 12,
            fontWeight: '500',
            color: textColor,
            minWidth: 32,
          }}
        >
          {formattedDuration}
        </Text>
      </View>
    </GestureDetector>
  );
});

VoiceMessagePlayer.displayName = 'VoiceMessagePlayer';
