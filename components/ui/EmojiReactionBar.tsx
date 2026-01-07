import React from 'react';
import { Text, Pressable, Dimensions } from 'react-native';
import Animated from 'react-native-reanimated';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

interface EmojiReactionBarProps {
  coordinates: { pageX: number; pageY: number } | null;
  messageAreaOffset: number;
  animatedStyle: any;
  onEmojiPress: (emoji: string) => void;
}

export function EmojiReactionBar({
  coordinates,
  messageAreaOffset,
  animatedStyle,
  onEmojiPress,
}: EmojiReactionBarProps) {
  if (!coordinates) return null;

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: Math.max(10, coordinates.pageY - messageAreaOffset - 50),
          left: Math.max(8, Math.min(coordinates.pageX, Dimensions.get('window').width - 250)),
          backgroundColor: 'white',
          borderRadius: 24,
          paddingHorizontal: 8,
          paddingVertical: 6,
          flexDirection: 'row',
          gap: 4,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.15,
          shadowRadius: 8,
          elevation: 5,
          zIndex: 1000,
        },
        animatedStyle,
      ]}
    >
      {REACTIONS.map((emoji) => (
        <Pressable
          key={emoji}
          onPress={() => onEmojiPress(emoji)}
          style={{ padding: 4 }}
        >
          <Text style={{ fontSize: 24 }}>{emoji}</Text>
        </Pressable>
      ))}
    </Animated.View>
  );
}
