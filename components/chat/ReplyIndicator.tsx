import React from 'react';
import { View, Text, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';
import type { Message } from '@/models';

interface ReplyIndicatorProps {
  message: Message;
  isOwn: boolean;
  onPress?: () => void;
}

export function ReplyIndicator({ message, isOwn, onPress }: ReplyIndicatorProps) {
  const { colors } = useTheme();

  if (!message.replyTo || message.replyTo.isDeleted) {
    return null;
  }

  return (
    <Pressable onPress={onPress}>
      <View
        style={{
          backgroundColor: isOwn ? colors.bubble.own.bg : colors.bubble.other.bg,
          opacity: 0.7,
          marginBottom: -16,
          alignSelf: isOwn ? 'flex-end' : 'flex-start',
          maxWidth: 220,
        }}
        className="rounded-2xl px-3 pb-8 pt-2">
        <View className="flex-row items-center gap-2">
          {message.replyTo.type === 'image' ? (
            <>
              <Ionicons
                name="image"
                size={14}
                color={isOwn ? colors.bubble.own.text : colors.bubble.other.text}
              />
              <Text
                style={{ color: isOwn ? colors.bubble.own.text : colors.bubble.other.text }}
                className="text-xs font-medium">
                Photo
              </Text>
            </>
          ) : message.replyTo.type === 'audio' ? (
            <>
              <Ionicons
                name="mic"
                size={14}
                color={isOwn ? colors.bubble.own.text : colors.bubble.other.text}
              />
              <Text
                style={{ color: isOwn ? colors.bubble.own.text : colors.bubble.other.text }}
                className="text-xs font-medium">
                Audio
              </Text>
            </>
          ) : (
            <Text
              style={{ color: isOwn ? colors.bubble.own.text : colors.bubble.other.text }}
              className="flex-shrink text-xs"
              numberOfLines={1}>
              {message.replyTo.content || 'Message'}
            </Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}
