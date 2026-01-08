import React from 'react';
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
 * AudioRecordingControls: Displays live recording state with waveform preview
 */
export function AudioRecordingControls({
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

  if (!isRecording) return null;

  return (
    <View className="mx-3 mb-2 rounded-xl bg-red-50 p-3 border border-red-200">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-2">
        <View className="flex-row items-center gap-2">
          <View className="h-2 w-2 rounded-full bg-red-500" />
          <Text className="text-sm font-semibold text-red-600">
            Recording... {formatTime(duration)}
          </Text>
        </View>
      </View>

      {/* Live Waveform Preview */}
      <View className="mb-3 h-10 flex-row items-center justify-center gap-0.5 rounded-md bg-white p-2">
        {waveform.length > 0 ? (
          waveform.map((amplitude, index) => (
            <View
              key={index}
              className="flex-1 rounded-sm bg-red-500"
              style={{
                height: `${Math.max(20, amplitude * 100)}%`,
              }}
            />
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
