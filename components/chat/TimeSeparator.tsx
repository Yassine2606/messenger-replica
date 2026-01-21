import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '@/contexts';
import { getDateLabel } from '@/lib/time-utils';

interface TimeSeparatorProps {
  date: Date | string;
}

export function TimeSeparator({ date }: TimeSeparatorProps) {
  const { colors } = useTheme();

  return (
    <View className="flex-row items-center gap-3 py-3">
      <View style={{ backgroundColor: colors.border.primary }} className="h-px flex-1" />
      <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
        {getDateLabel(date)}
      </Text>
      <View style={{ backgroundColor: colors.border.primary }} className="h-px flex-1" />
    </View>
  );
}
