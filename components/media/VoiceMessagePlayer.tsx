import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '@/contexts';
import Svg, { Line } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import type { Message } from '@/models';
import { UserAvatar } from '../user';

interface VoiceMessagePlayerProps {
  audioUrl: string;
  waveform: number[]; // Normalized 0-1 array
  duration: number; // milliseconds
  isOwn?: boolean; // Whether this is the current user's message
  message?: Message; // Message object for context menu
  previousMessage?: Message; // For grouping detection
  nextMessage?: Message; // For grouping detection
  onContextMenu?: (message: Message) => void;
}

/**
 * SVG Waveform Visualization - renders audio waveform with symmetric top/bottom bars
 * Messenger-style: Clean, minimal bars that go both up and down from center
 * Responsive to container width with dynamic bar spacing
 * Color changes based on playback progress position
 */
const SvgWaveform = React.memo(
  ({
    waveform,
    waveColor,
    playedColor,
    progress,
    height = 36,
    width = 100,
  }: {
    waveform: number[];
    waveColor: string;
    playedColor: string;
    progress: number;
    height?: number;
    width?: number;
  }) => {
    if (!waveform || waveform.length === 0) {
      // Dynamic placeholder based on width - more compact bars
      const placeholderCount = Math.max(8, Math.floor(width / 8));
      const barSpacing = width / (placeholderCount + 1);

      return (
        <Svg width="100%" height={height} preserveAspectRatio="none">
          {Array.from({ length: placeholderCount }).map((_, i) => {
            const barPosition = (i + 1) / (placeholderCount + 1);
            const barColor = barPosition <= progress ? playedColor : waveColor;
            
            return (
              <React.Fragment key={`placeholder-${i}`}>
                {/* Top bar */}
                <Line
                  x1={(i + 1) * barSpacing}
                  y1={height / 2}
                  x2={(i + 1) * barSpacing}
                  y2={height / 2 - 3}
                  stroke={barColor}
                  strokeWidth="1.5"
                  opacity="0.3"
                  strokeLinecap="round"
                />
                {/* Bottom bar - mirror of top */}
                <Line
                  x1={(i + 1) * barSpacing}
                  y1={height / 2}
                  x2={(i + 1) * barSpacing}
                  y2={height / 2 + 3}
                  stroke={barColor}
                  strokeWidth="1.5"
                  opacity="0.3"
                  strokeLinecap="round"
                />
              </React.Fragment>
            );
          })}
        </Svg>
      );
    }

    // Dynamic bar count - more compact (target 3px total per bar)
    const barWidth = 3;
    const barGap = 1.5;
    const barWithGap = barWidth + barGap;
    const dynamicBarCount = Math.max(8, Math.floor(width / barWithGap));
    
    // Sample waveform data - reduce to dynamicBarCount for cleaner visualization
    const sampleWaveform = waveform.slice(0, dynamicBarCount);
    const centerY = height / 2;
    const maxAmplitude = Math.max(...sampleWaveform, 0.1) || 0.1;
    const barSpacing = width / (sampleWaveform.length + 1);

    return (
      <Svg width="100%" height={height} preserveAspectRatio="none">
        {sampleWaveform.map((amplitude, i) => {
          const barPosition = (i + 1) / (sampleWaveform.length + 1);
          const barColor = barPosition <= progress ? playedColor : waveColor;
          const normalizedAmplitude = (amplitude / maxAmplitude) * (height / 2 - 2);
          const x = (i + 1) * barSpacing;
          const barHeight = Math.max(2, normalizedAmplitude);
          
          return (
            <React.Fragment key={`wave-${i}`}>
              {/* Top bar */}
              <Line
                x1={x}
                y1={centerY - 1}
                x2={x}
                y2={centerY - 1 - barHeight}
                stroke={barColor}
                strokeWidth={barWidth}
                strokeLinecap="round"
              />
              {/* Bottom bar - mirror of top for symmetric visualization */}
              <Line
                x1={x}
                y1={centerY + 1}
                x2={x}
                y2={centerY + 1 + barHeight}
                stroke={barColor}
                strokeWidth={barWidth}
                strokeLinecap="round"
              />
            </React.Fragment>
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
  previousMessage,
  nextMessage,
  onContextMenu,
}: VoiceMessagePlayerProps) {
  // Grouping logic - same as MessageBubble
  const isSameSender = useMemo(() => {
    return message?.senderId === previousMessage?.senderId;
  }, [message?.senderId, previousMessage?.senderId]);

  const isWithinMinute = useMemo(() => {
    if (!message?.createdAt || !previousMessage?.createdAt) return false;
    const d1 = typeof message.createdAt === 'string' ? new Date(message.createdAt).getTime() : new Date(message.createdAt).getTime();
    const d2 = typeof previousMessage.createdAt === 'string' ? new Date(previousMessage.createdAt).getTime() : new Date(previousMessage.createdAt).getTime();
    return Math.abs(d1 - d2) < 60000; // 1 minute threshold
  }, [message?.createdAt, previousMessage?.createdAt]);

  const isGroupedWithPrevious = useMemo(() => {
    return isSameSender && isWithinMinute;
  }, [isSameSender, isWithinMinute]);

  const player = useAudioPlayer({ uri: audioUrl }, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  // Shared values for smooth continuous animation
  const playbackProgress = useSharedValue(0);
  const containerWidth = useSharedValue(200); // Waveform container width (updated on layout)
  const hasStartedPlayingShared = useSharedValue(0); // 0 = false, 1 = true (shared value for animation)
  const [measuredWidth, setMeasuredWidth] = useState(200);
  const playbackStartTimeRef = useRef<number | null>(null); // Timestamp when playback started
  const playbackStartPositionRef = useRef<number>(0); // Audio position when playback started
  const lastDurationRef = useRef<number>(0); // Cache duration to detect changes

  // Configure audio mode for iOS speaker playback
  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {
      // Silently fail on web/unsupported platforms
    });
  }, []);

  // Detect play state changes and update progress
  useEffect(() => {
    if (!status.isLoaded || status.duration === 0) return;

    if (status.playing) {
      // Start playing - capture start position
      playbackStartTimeRef.current = Date.now();
      playbackStartPositionRef.current = status.currentTime;
      hasStartedPlayingShared.value = 1; // Mark as started
    } else {
      // Paused - sync to actual position
      playbackStartTimeRef.current = null;
      const currentProgress = Math.min(1, Math.max(0, status.currentTime / status.duration));
      playbackProgress.value = currentProgress;
    }
  }, [status.playing, status.isLoaded, status.duration, playbackProgress, hasStartedPlayingShared]);

  // Continuously update progress during playback using timestamp-based sync
  useEffect(() => {
    if (!status.playing || !playbackStartTimeRef.current || status.duration === 0) return;

    const updateProgress = () => {
      if (!playbackStartTimeRef.current) return;

      const elapsedMs = Date.now() - playbackStartTimeRef.current;
      const expectedPosition = playbackStartPositionRef.current + (elapsedMs / 1000);
      const expectedProgress = Math.min(1, Math.max(0, expectedPosition / status.duration));

      playbackProgress.value = expectedProgress;
    };

    const interval = setInterval(updateProgress, 50);
    return () => clearInterval(interval);
  }, [status.playing, status.duration, playbackProgress]);

  // Reset when audio finishes
  useEffect(() => {
    if (status.didJustFinish && player && status.isLoaded) {
      // Ensure progress is at exactly 1.0 before resetting
      playbackProgress.value = withTiming(1, { duration: 0 });
      setTimeout(() => {
        try {
          player.pause();
          player.seekTo(0);
        } catch (error) {
          console.warn('Error resetting audio:', error);
        }
        playbackProgress.value = 0;
        hasStartedPlayingShared.value = 0; // Reset started flag
        playbackStartTimeRef.current = null;
        playbackStartPositionRef.current = 0;
      }, 50);
    }
  }, [status.didJustFinish, status.isLoaded, player, playbackProgress, hasStartedPlayingShared]);

  const handlePlayPause = useCallback(() => {
    if (!player || !status.isLoaded) return;
    try {
      if (status.playing) {
        player.pause();
      } else {
        player.play();
      }
    } catch (error) {
      console.warn('Audio playback error:', error);
    }
  }, [status.playing, status.isLoaded, player]);

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
      if (!duration || !status.isLoaded || !player) return;

      try {
        const { locationX } = event.nativeEvent;
        const currentContainerWidth = containerWidth.value;
        const progress = Math.max(0, Math.min(1, locationX / currentContainerWidth));
        const seekTime = progress * (duration / 1000);

        playbackProgress.value = progress;
        player.seekTo(seekTime);
      } catch (error) {
        console.warn('Error seeking audio:', error);
      }
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
  
  const { colors } = useTheme();
  const bgColor = useMemo(() => (isOwn ? colors.audio.own.bg : colors.audio.other.bg), [isOwn, colors]);
  const waveColor = useMemo(
    () => (isOwn ? 'rgba(255, 255, 255, 0.5)' : colors.audio.other.waveColor + '66'),
    [isOwn, colors]
  );
  const playedWaveColor = useMemo(() => (isOwn ? colors.audio.own.waveColor : colors.audio.other.waveColor), [isOwn, colors]);
  const playButtonColor = useMemo(() => (isOwn ? colors.audio.own.playButtonColor : colors.audio.other.playButtonColor), [isOwn, colors]);
  const textColor = useMemo(() => (isOwn ? colors.audio.own.text : colors.audio.other.text), [isOwn, colors]);

  const formattedDuration = useMemo(
    () => formatTime(durationSeconds),
    [durationSeconds, formatTime]
  );

  // Animated style for playback indicator
  const indicatorStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, playbackProgress.value));
    const translateX = progress * containerWidth.value;
    return {
      transform: [{ translateX }],
      opacity: hasStartedPlayingShared.value, // Uses shared value instead of state
    };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 2 }}>
      {/* Avatar - only show for other people's messages when not grouped with previous */}
      {!isOwn && !isGroupedWithPrevious && (
        <View className="mb-2">
          <UserAvatar avatarUrl={message?.sender?.avatarUrl} userName={message?.sender?.name} size="sm" />
        </View>
      )}

      {/* Spacer when avatar is hidden (grouped with previous) */}
      {!isOwn && isGroupedWithPrevious && (
        <View className="mb-2 w-9" />
      )}

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
            width: 200,
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
            backgroundColor: isOwn
              ? 'rgba(255, 255, 255, 0.2)'
              : colors.audio.other.playButtonColor + '1A',
          }}>
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
            const width = e.nativeEvent.layout.width - 4; // Subtract padding
            containerWidth.value = width;
            setMeasuredWidth(width);
          }}
          style={{
            flex: 1,
            height: 36,
            borderRadius: 6,
            overflow: 'hidden',
            position: 'relative',
            paddingHorizontal: 2,
            justifyContent: 'center',
          }}
        >
          {/* SVG Waveform Visualization */}
          <SvgWaveform 
            waveform={waveform} 
            waveColor={waveColor}
            playedColor={playedWaveColor}
            progress={playbackProgress.value}
            height={36}
            width={measuredWidth}
          />

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
    </View>
  );
});

VoiceMessagePlayer.displayName = 'VoiceMessagePlayer';
