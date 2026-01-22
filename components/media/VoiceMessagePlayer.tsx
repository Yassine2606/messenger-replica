import React, { useCallback, useMemo, useEffect, useRef, useState } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useTheme } from '@/contexts';
import { useAudioStore } from '@/stores';
import { shallow } from 'zustand/shallow';
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
  waveform: number[];
  duration: number;
  isOwn?: boolean;
  message?: Message;
  previousMessage?: Message;
  nextMessage?: Message;
  onContextMenu?: (message: Message) => void;
}

/**
 * VoiceMessagePlayer: Simple voice message player
 * Design: Blue background, play button, progress bar, duration
 * Features: Clean playback controls with progress indicator
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
  // Subscribe to audio store to know if THIS message is currently playing
  const currentlyPlayingMessageId = useAudioStore((state) => state.currentlyPlayingMessageId);
  const setCurrentlyPlaying = useAudioStore((state) => state.setCurrentlyPlaying);
  const isCurrentlyPlaying = message?.id ? currentlyPlayingMessageId === message.id : false;

  const isSameSender = useMemo(() => {
    return message?.senderId === previousMessage?.senderId;
  }, [message?.senderId, previousMessage?.senderId]);

  const isWithinMinute = useMemo(() => {
    if (!message?.createdAt || !previousMessage?.createdAt) return false;
    const d1 =
      typeof message.createdAt === 'string'
        ? new Date(message.createdAt).getTime()
        : new Date(message.createdAt).getTime();
    const d2 =
      typeof previousMessage.createdAt === 'string'
        ? new Date(previousMessage.createdAt).getTime()
        : new Date(previousMessage.createdAt).getTime();
    return Math.abs(d1 - d2) < 60000;
  }, [message?.createdAt, previousMessage?.createdAt]);

  const isGroupedWithPrevious = useMemo(() => {
    return isSameSender && isWithinMinute;
  }, [isSameSender, isWithinMinute]);

  const player = useAudioPlayer({ uri: audioUrl }, { downloadFirst: true });
  const status = useAudioPlayerStatus(player);

  const localPlaybackProgress = useSharedValue(0);
  const containerWidth = useSharedValue(200);
  const hasStartedPlayingShared = useSharedValue(0);
  const [measuredWidth, setMeasuredWidth] = useState(200);
  const playbackStartTimeRef = useRef<number | null>(null);
  const playbackStartPositionRef = useRef<number>(0);

  useEffect(() => {
    setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: 'duckOthers',
    }).catch(() => {});
  }, []);

  // When this player should stop (another message started playing)
  useEffect(() => {
    if (message?.id && !isCurrentlyPlaying && status.playing) {
      try {
        player.pause();
      } catch (error) {
        console.warn('Error pausing audio:', error);
      }
    }
  }, [isCurrentlyPlaying, message?.id, player, status.playing]);

  useEffect(() => {
    if (!status.isLoaded || status.duration === 0) return;

    if (status.playing) {
      playbackStartTimeRef.current = Date.now();
      playbackStartPositionRef.current = status.currentTime;
      hasStartedPlayingShared.value = 1;
    } else {
      playbackStartTimeRef.current = null;
      const currentProgress = Math.min(1, Math.max(0, status.currentTime / status.duration));
      localPlaybackProgress.value = currentProgress;
    }
  }, [status.playing, status.isLoaded, status.duration, localPlaybackProgress, hasStartedPlayingShared]);

  useEffect(() => {
    if (!status.playing || !playbackStartTimeRef.current || status.duration === 0) return;

    const updateProgress = () => {
      if (!playbackStartTimeRef.current) return;

      const elapsedMs = Date.now() - playbackStartTimeRef.current;
      const expectedPosition = playbackStartPositionRef.current + elapsedMs / 1000;
      const expectedProgress = Math.min(1, Math.max(0, expectedPosition / status.duration));

      localPlaybackProgress.value = expectedProgress;
    };

    const interval = setInterval(updateProgress, 50);
    return () => clearInterval(interval);
  }, [status.playing, status.duration, localPlaybackProgress]);

  useEffect(() => {
    if (status.didJustFinish && player && status.isLoaded) {
      localPlaybackProgress.value = withTiming(1, { duration: 0 });
      setTimeout(() => {
        try {
          player.pause();
          player.seekTo(0);
        } catch (error) {
          console.warn('Error resetting audio:', error);
        }
        localPlaybackProgress.value = 0;
        hasStartedPlayingShared.value = 0;
        playbackStartTimeRef.current = null;
        playbackStartPositionRef.current = 0;
        if (message?.id) {
          setCurrentlyPlaying(null);
        }
      }, 50);
    }
  }, [status.didJustFinish, status.isLoaded, player, localPlaybackProgress, hasStartedPlayingShared, message?.id, setCurrentlyPlaying]);

  const handlePlayPause = useCallback(() => {
    if (!player || !status.isLoaded || !message?.id) return;
    try {
      if (status.playing) {
        player.pause();
        setCurrentlyPlaying(null);
      } else {
        // Stop any other playing audio
        setCurrentlyPlaying(message.id);
        player.play();
      }
    } catch (error) {
      console.warn('Audio playback error:', error);
    }
  }, [status.playing, status.isLoaded, player, message?.id, setCurrentlyPlaying]);

  const handleLongPress = useCallback(() => {
    if (!message) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});

    onContextMenu?.(message);
  }, [message, onContextMenu]);

  const longPressGesture = Gesture.LongPress()
    .minDuration(300)
    .onStart(() => {
      runOnJS(handleLongPress)();
    });

  const handleProgressPress = useCallback(
    (event: any) => {
      if (!duration || !status.isLoaded || !player) return;

      try {
        const { locationX } = event.nativeEvent;
        const currentContainerWidth = containerWidth.value;
        const progress = Math.max(0, Math.min(1, locationX / currentContainerWidth));
        const seekTime = progress * (duration / 1000);

        localPlaybackProgress.value = progress;
        player.seekTo(seekTime);
      } catch (error) {
        console.warn('Error seeking audio:', error);
      }
    },
    [duration, player, localPlaybackProgress, status.isLoaded, containerWidth]
  );

  const formatTime = useCallback((seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, []);

  const durationSeconds = useMemo(() => duration / 1000, [duration]);

  const { colors } = useTheme();
  const bgColor = useMemo(
    () => (isOwn ? colors.audio.own.bg : colors.audio.other.bg),
    [isOwn, colors]
  );
  const playButtonColor = useMemo(
    () => (isOwn ? colors.audio.own.playButtonColor : colors.audio.other.playButtonColor),
    [isOwn, colors]
  );
  const textColor = useMemo(
    () => (isOwn ? colors.audio.own.text : colors.audio.other.text),
    [isOwn, colors]
  );

  const formattedDuration = useMemo(
    () => formatTime(durationSeconds),
    [durationSeconds, formatTime]
  );

  const indicatorStyle = useAnimatedStyle(() => {
    const progress = Math.min(1, Math.max(0, localPlaybackProgress.value));
    const translateX = progress * containerWidth.value;
    return {
      transform: [{ translateX }],
      opacity: hasStartedPlayingShared.value,
    };
  });

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 7, marginBottom: 2 }}>
      {!isOwn && !isGroupedWithPrevious && (
        <View className="mb-2">
          <UserAvatar
            avatarUrl={message?.sender?.avatarUrl}
            userName={message?.sender?.name}
            size="sm"
          />
        </View>
      )}

      {!isOwn && isGroupedWithPrevious && <View className="mb-2 w-9" />}

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
          }}>
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
                !status.isLoaded
                  ? 'hourglass-outline'
                  : status.playing
                    ? 'pause-sharp'
                    : 'play-sharp'
              }
              size={18}
              color={playButtonColor}
            />
          </Pressable>

          <Pressable
            onPress={handleProgressPress}
            onLayout={(e) => {
              const width = e.nativeEvent.layout.width - 4;
              containerWidth.value = width;
              setMeasuredWidth(width);
            }}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              overflow: 'hidden',
              position: 'relative',
              paddingHorizontal: 2,
              justifyContent: 'center',
              backgroundColor: isOwn
                ? 'rgba(255, 255, 255, 0.3)'
                : colors.audio.other.waveColor + '33',
            }}>
            <Animated.View
              style={[
                {
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: 3,
                  backgroundColor: playButtonColor,
                  borderRadius: 1.5,
                },
                indicatorStyle,
              ]}
            />
          </Pressable>

          <Text
            style={{
              fontSize: 12,
              fontWeight: '500',
              color: textColor,
              minWidth: 32,
            }}>
            {formattedDuration}
          </Text>
        </View>
      </GestureDetector>
    </View>
  );
});

VoiceMessagePlayer.displayName = 'VoiceMessagePlayer';
