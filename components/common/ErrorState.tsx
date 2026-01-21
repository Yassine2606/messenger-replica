import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

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
  const { colors } = useTheme();

  if (!error && !isLoading) {
    return null;
  }

  const errorMessage = message || error?.message || 'Something went wrong. Please try again.';

  if (compact) {
    return (
      <View
        style={{
          backgroundColor: `${colors.error}15`,
          borderLeftColor: colors.error,
        }}
        className="flex-row items-center gap-2 border-l-4 px-3 py-2">
        <Ionicons name="alert-circle" size={16} color={colors.error} />
        <Text style={{ color: colors.text.primary }} className="flex-1 text-xs">
          {errorMessage}
        </Text>
        {onRetry && !isLoading && (
          <Pressable
            onPress={onRetry}
            style={{ backgroundColor: `${colors.error}20` }}
            className="rounded px-2 py-1">
            <Text style={{ color: colors.error }} className="text-xs font-semibold">
              Retry
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View
      style={{ backgroundColor: colors.bg.secondary }}
      className="flex-1 items-center justify-center px-6">
      <View
        style={{ backgroundColor: colors.bg.tertiary }}
        className="mb-6 h-20 w-20 items-center justify-center rounded-full">
        <Ionicons name="alert-circle-outline" size={40} color={colors.error} />
      </View>
      <Text
        style={{ color: colors.text.primary }}
        className="text-center text-lg font-semibold">
        Unable to load
      </Text>
      <Text
        style={{ color: colors.text.secondary }}
        className="mt-2 text-center text-sm">
        {errorMessage}
      </Text>
      {onRetry && (
        <Pressable
          onPress={onRetry}
          disabled={isLoading}
          style={{ backgroundColor: colors.primary }}
          className="mt-6 rounded-lg px-6 py-3">
          <Text style={{ color: colors.text.inverted }} className="text-center font-semibold">
            {isLoading ? 'Retrying...' : 'Try Again'}
          </Text>
        </Pressable>
      )}
    </View>
  );
}
