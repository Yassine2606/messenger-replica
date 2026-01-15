import React, { useMemo, useEffect } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, Easing } from 'react-native-reanimated';
import { useTheme } from '@/contexts';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface AudioRecordingControlsProps {
  isRecording: boolean;
  duration: number;
  waveform: number[];
  onStop: () => void;
  onCancel: () => void;
}

/**
 * AudioRecordingControls: Clean and simple recording UI
 * Features:
 * - Recording status with pulsing indicator
 * - Duration timer
 * - Clear cancel and send buttons
 * - Dark/light theme support
 */
export const AudioRecordingControls = React.memo(
  function AudioRecordingControls({
    isRecording,
    duration,
    waveform,
    onStop,
    onCancel,
  }: AudioRecordingControlsProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formattedDuration = useMemo(() => formatTime(duration), [duration]);

    // Pulse animation for recording indicator
    const pulseScale = useSharedValue(1);

    useEffect(() => {
      if (isRecording) {
        pulseScale.value = withTiming(1.2, {
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
        });

        const interval = setInterval(() => {
          pulseScale.value = withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) });
          setTimeout(() => {
            pulseScale.value = withTiming(1.2, { duration: 500, easing: Easing.inOut(Easing.ease) });
          }, 500);
        }, 1000);

        return () => clearInterval(interval);
      }
    }, [isRecording, pulseScale]);

    const pulseStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulseScale.value }],
    }));

    if (!isRecording) return null;

    return (
      <View
        style={{
          backgroundColor: colors.bg.primary,
          borderTopColor: colors.border.primary,
          paddingBottom: insets.bottom,
          paddingTop: 12,
        }}
        className="border-t">
        {/* Header with recording indicator */}
        <View className="mb-4 flex-row items-center justify-between px-4">
          <View className="flex-row items-center gap-3">
            <Animated.View
              style={[
                {
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: '#EF4444',
                },
                pulseStyle,
              ]}
            />
            <View>
              <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                Recording Audio
              </Text>
              <Text style={{ color: colors.text.primary }} className="mt-0.5 text-sm font-semibold">
                {formattedDuration}
              </Text>
            </View>
          </View>
          <Ionicons name="mic" size={20} color={colors.text.tertiary} />
        </View>

        {/* Live Waveform */}
        <View
          style={{
            backgroundColor: colors.input.bg,
            borderColor: colors.input.border,
            borderRadius: 12,
            marginHorizontal: 16,
            marginBottom: 16,
            paddingVertical: 12,
            paddingHorizontal: 8,
            borderWidth: 1,
          }}>
          <View className="items-center justify-center h-12">
            <Ionicons name="volume-mute" size={32} color={colors.primary} />
          </View>
        </View>

        {/* Action Buttons */}
        <View className="flex-row items-center justify-center gap-4 px-4 pb-2">
          <Pressable
            onPress={onCancel}
            style={{
              backgroundColor: colors.bg.secondary,
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
            }}
            android_ripple={{ color: 'rgba(0,0,0,0.1)' }}>
            <Ionicons name="close" size={18} color={colors.text.primary} />
            <Text style={{ color: colors.text.primary }} className="font-semibold">
              Cancel
            </Text>
          </Pressable>

          <Pressable
            onPress={onStop}
            style={{
              backgroundColor: colors.primary,
              borderRadius: 12,
              paddingHorizontal: 20,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              flex: 1,
              justifyContent: 'center',
            }}
            android_ripple={{ color: 'rgba(0,0,0,0.1)' }}>
            <Ionicons name="send" size={18} color={colors.text.inverted} />
            <Text style={{ color: colors.text.inverted }} className="font-semibold">
              Send Audio
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }
);
