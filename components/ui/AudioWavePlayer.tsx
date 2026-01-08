import React, { useCallback } from 'react';
import { View, Pressable, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';

interface AudioWavePlayerProps {
  audioUrl: string;
  waveform: number[]; // Normalized 0-1 array
  duration: number; // milliseconds
  onPlaybackStatusUpdate?: (isPlaying: boolean, position: number) => void;
}

/**
 * AudioWavePlayer: Displays and plays audio with real waveform visualization
 * - Uses provided waveform data (no randomization)
 * - Playback progress synced to waveform
 * - Tap waveform to seek
 */
export function AudioWavePlayer({
  audioUrl,
  waveform,
  duration,
  onPlaybackStatusUpdate,
}: AudioWavePlayerProps) {
  const player = useAudioPlayer({ uri: audioUrl });
  const status = useAudioPlayerStatus(player);
  const progressRef = useSharedValue(0);

  const handlePlayPause = useCallback(() => {
    if (status.playing) {
      player.pause();
    } else {
      player.play();
    }
  }, [status.playing, player]);

  const handleWaveformPress = useCallback(
    (event: any) => {
      if (!duration) return;

      const { locationX } = event.nativeEvent;
      const containerWidth = event.currentTarget?.offsetWidth || 1;
      const progress = locationX / containerWidth;
      const seekTime = progress * (duration / 1000); // Convert to seconds

      player.seekTo(seekTime);
    },
    [duration, player]
  );

  // Update progress when status changes
  React.useEffect(() => {
    if (status.isLoaded && status.duration > 0) {
      const progress = status.currentTime / status.duration;
      progressRef.value = progress;
      onPlaybackStatusUpdate?.(status.playing, status.currentTime * 1000);
    }
  }, [status.currentTime, status.playing, status.isLoaded, status.duration, onPlaybackStatusUpdate]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  const durationSeconds = duration / 1000;

  return (
    <View className="flex-row items-center gap-3 rounded-lg bg-blue-50 px-3 py-2">
      {/* Play/Pause Button */}
      <Pressable
        onPress={handlePlayPause}
        disabled={!status.isLoaded}
        className="h-8 w-8 items-center justify-center rounded-full active:bg-blue-100">
        <Ionicons
          name={
            !status.isLoaded
              ? 'hourglass-outline'
              : status.playing
                ? 'pause'
                : 'play'
          }
          size={16}
          color="#3B82F6"
        />
      </Pressable>

      {/* Waveform Display */}
      <Pressable
        onPress={handleWaveformPress}
        className="flex-1 overflow-hidden rounded-md bg-white py-3"
        style={{
          minHeight: 30,
        }}>
        <View className="relative h-full flex-row items-center gap-0.5 px-2">
          {/* Waveform bars */}
          {waveform.length > 0 ? (
            waveform.map((amplitude, index) => {
              const isPlayed = (progressRef.value || 0) * waveform.length > index;
              return (
                <View
                  key={index}
                  className="flex-1"
                  style={{
                    height: `${Math.max(20, amplitude * 100)}%`,
                    backgroundColor: isPlayed ? '#3B82F6' : '#93C5FD',
                  }}
                />
              );
            })
          ) : (
            <View className="flex-1 bg-gray-300" style={{ height: '40%' }} />
          )}
        </View>
      </Pressable>

      {/* Duration */}
      <Text className="w-10 text-right text-xs text-gray-600">
        {formatTime(durationSeconds)}
      </Text>
    </View>
  );
}
