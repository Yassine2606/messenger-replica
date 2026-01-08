import React, { useMemo } from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface AudioRecordingControlsProps {
  isRecording: boolean;
  duration: number;
  waveform: number[];
  onStop: () => void;
  onCancel: () => void;
}

/**
 * Memoized waveform bar component to prevent unnecessary re-renders
 */
const WaveformBar = React.memo(
  ({ amplitude, index }: { amplitude: number; index: number }) => {
    return (
      <View
        key={index}
        className="flex-1 rounded-sm bg-red-500"
        style={{
          height: `${Math.max(15, amplitude * 100)}%`,
        }}
      />
    );
  }
);

WaveformBar.displayName = 'WaveformBar';

/**
 * AudioRecordingControls: Displays live recording state with real-time waveform
 * Optimized with React.memo and memoized computations to prevent excessive re-renders
 */
export const AudioRecordingControls = React.memo(
  function AudioRecordingControls({
    isRecording,
    duration,
    waveform,
    onStop,
    onCancel,
  }: AudioRecordingControlsProps) {
    const formatTime = (ms: number) => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    };

    // Show last 20 waveform bars for live preview
    const displayWaveform = useMemo(() => {
      if (waveform.length === 0) return [];
      return waveform.slice(-20);
    }, [waveform]);

    const formattedDuration = useMemo(() => formatTime(duration), [duration]);

    if (!isRecording) return null;

    return (
      <View className="mx-3 mb-2 rounded-xl bg-red-50 p-3 border border-red-200">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-2">
          <View className="flex-row items-center gap-2">
            <View className="h-2 w-2 rounded-full bg-red-500" />
            <Text className="text-sm font-semibold text-red-600">
              Recording... {formattedDuration}
            </Text>
          </View>
        </View>

        {/* Live Waveform Preview */}
        <View className="mb-3 h-12 flex-row items-center justify-center gap-1 rounded-md bg-white p-2">
          {displayWaveform.length > 0 ? (
            displayWaveform.map((amplitude, index) => (
              <WaveformBar key={index} amplitude={amplitude} index={index} />
            ))
          ) : (
            <View className="flex-1 bg-gray-300" style={{ height: '40%' }} />
          )}
        </View>

        {/* Controls */}
        <View className="flex-row items-center justify-center gap-4">
          <Pressable
            onPress={onCancel}
            className="flex-row items-center gap-2 rounded-full bg-gray-100 px-3 py-2 active:bg-gray-200">
            <Ionicons name="close" size={16} color="#6B7280" />
            <Text className="text-xs font-semibold text-gray-700">Cancel</Text>
          </Pressable>

          <Pressable
            onPress={onStop}
            className="flex-row items-center gap-2 rounded-full bg-red-500 px-4 py-2 active:bg-red-600">
            <Ionicons name="stop" size={16} color="white" />
            <Text className="text-xs font-semibold text-white">Send</Text>
          </Pressable>
        </View>
      </View>
    );
  }
);
