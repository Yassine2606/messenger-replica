import React from 'react';
import { View, Text } from 'react-native';
import { MESSAGE } from '@/lib/chat-constants';

interface TimeSeparatorProps {
  date: Date | string;
}

export function TimeSeparator({ date }: TimeSeparatorProps) {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  
  const getTimeLabel = (): string => {
    const diffMs = now.getTime() - dateObj.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Less than a minute
    if (diffMins < 1) {
      return 'just now';
    }

    // Minutes
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    }

    // Hours
    if (diffHours < 24) {
      return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    }

    // Yesterday
    if (diffDays === 1) {
      const time = dateObj.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `yesterday at ${time}`;
    }

    // Older messages: show full date and time
    const date = dateObj.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: dateObj.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });

    const time = dateObj.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

    return `${date} at ${time}`;
  };

  return (
    <View className="flex-row items-center gap-3 py-4">
      <View className="flex-1 h-px bg-gray-200" />
      <Text className="text-xs text-gray-500">{getTimeLabel()}</Text>
      <View className="flex-1 h-px bg-gray-200" />
    </View>
  );
}
