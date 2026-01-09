import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Message } from '@/models';

interface ReplyIndicatorProps {
  message: Message;
  isOwn: boolean;
  onPress?: () => void;
}

export function ReplyIndicator({ message, onPress }: ReplyIndicatorProps) {
  if (!message.replyTo || message.replyTo.isDeleted) {
    return null;
  }

  return (
    <Pressable onPress={onPress}>
      <View
        className={`rounded-2xl px-3 pt-2 pb-8 bg-gray-200`}
        style={{ 
          opacity: 0.5,
          marginBottom: -16,
          alignSelf: 'flex-start',
          maxWidth: 220,
        }}>
        <View className="flex-row items-center gap-2">
          {message.replyTo.type === 'image' ? (
            <>
              <Ionicons name="image" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-600 font-medium">Photo</Text>
            </>
          ) : message.replyTo.type === 'audio' ? (
            <>
              <Ionicons name="mic" size={14} color="#6B7280" />
              <Text className="text-xs text-gray-600 font-medium">Audio</Text>
            </>
          ) : (
            <Text className="text-xs text-gray-700 flex-shrink" numberOfLines={1}>
              {message.replyTo.content || 'Message'}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
