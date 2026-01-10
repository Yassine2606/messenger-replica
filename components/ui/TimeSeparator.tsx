import React from 'react';
import { View, Text } from 'react-native';
import { getDateLabel } from '@/lib/time-utils';

interface TimeSeparatorProps {
  date: Date | string;
}

/**
 * Time Separator Component - Messenger/Instagram style
 * Shows date separator only for day boundaries, not time gaps
 * 
 * Display rules:
 * - Today: "Today"
 * - Yesterday: "Yesterday"
 * - This week: Day name (e.g., "Monday")
 * - This year: "Jan 15"
 * - Other years: "Jan 15, 2025"
 */
export function TimeSeparator({ date }: TimeSeparatorProps) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      <View className="flex-1 h-px bg-gray-200" />
      <Text className="text-xs font-medium text-gray-600">{getDateLabel(date)}</Text>
      <View className="flex-1 h-px bg-gray-200" />
    </View>
  );
}
