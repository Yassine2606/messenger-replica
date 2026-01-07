import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ErrorStateProps {
  error: Error | null;
  isLoading?: boolean;
  onRetry?: () => void;
  message?: string;
  compact?: boolean;
}

export function ErrorState({
  error,
  isLoading,
  onRetry,
  message,
  compact = false,
}: ErrorStateProps) {
  if (!error && !isLoading) {
    return null;
  }

  const errorMessage =
    message ||
    error?.message ||
    'Something went wrong. Please try again.';

  if (compact) {
    return (
      <View className="flex-row items-center gap-2 bg-red-50 border-l-4 border-red-500 px-3 py-2">
        <Ionicons name="alert-circle" size={16} color="#EF4444" />
        <Text className="flex-1 text-xs text-red-700">{errorMessage}</Text>
        {onRetry && !isLoading && (
          <Pressable
            onPress={onRetry}
            className="px-2 py-1 bg-red-100 rounded">
            <Text className="text-xs font-semibold text-red-700">Retry</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 items-center justify-center bg-gray-50 px-6">
      <Ionicons name="alert-circle-outline" size={48} color="#EF4444" />
      <Text className="mt-4 text-lg font-semibold text-gray-900 text-center">
        Unable to load
      </Text>
      <Text className="mt-2 text-center text-sm text-gray-600">
        {errorMessage}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          disabled={isLoading}
          className="mt-6 px-6 py-3 bg-blue-500 rounded-lg">
          <Text className="text-center font-semibold text-white">
            {isLoading ? 'Retrying...' : 'Try Again'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
