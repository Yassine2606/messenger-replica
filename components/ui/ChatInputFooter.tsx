import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { Message } from '@/models';

interface ChatInputFooterProps {
  messageText: string;
  onChangeText: (text: string) => void;
  onSend: () => void;
  replyToMessage: Message | null;
  onCancelReply: () => void;
  sendingMessage: boolean;
  inputRef: React.RefObject<TextInput | null>;
  onPickImage: () => void;
  onTakePhoto: () => void;
  onPickAudio: () => void;
}

/**
 * ChatInputFooter: Messenger-style input with proper keyboard persistence
 *
 * Features:
 * - Input stays focused after send (keyboard persists)
 * - Auto-focus on reply action
 * - Smooth transitions
 * - Proper safe area handling
 * - Disabled states while sending/uploading
 * - Full accessibility support
 */
export function ChatInputFooter({
  messageText,
  onChangeText,
  onSend,
  replyToMessage,
  onCancelReply,
  sendingMessage,
  inputRef,
  onPickImage,
  onTakePhoto,
  onPickAudio,
}: ChatInputFooterProps) {
  const insets = useSafeAreaInsets();
  const hasText = messageText.trim().length > 0;
  const canSend = hasText && !sendingMessage;

  return (
    <View
      className="bg-white border-t border-gray-100"
      style={{
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      }}>
      {/* Reply indicator */}
      {replyToMessage && (
        <View className="mx-3 mb-2 flex-row items-center rounded-xl bg-blue-50 px-3 py-2 border-l-4 border-blue-500">
          <View className="flex-1">
            <Text className="text-xs font-semibold text-blue-600">
              Replying to {replyToMessage.sender?.name || 'User'}
            </Text>
            <Text className="mt-1 text-sm text-gray-800" numberOfLines={1}>
              {replyToMessage.type === 'image'
                ? '📷 Photo'
                : replyToMessage.type === 'audio'
                  ? '🎵 Audio'
                  : replyToMessage.content || 'Message'}
            </Text>
          </View>
          <Pressable
            onPress={onCancelReply}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply">
            <Ionicons name="close" size={20} color="#3B82F6" />
          </Pressable>
        </View>
      )}

      {/* Input controls */}
      <View className="flex-row items-center px-3 gap-2">
        {/* Camera button */}
        <Pressable
          className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
          onPress={onTakePhoto}
          disabled={sendingMessage}
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          accessibilityHint="Opens camera to take a photo">
          <Ionicons
            name="camera-outline"
            size={24}
            color={sendingMessage ? '#D1D5DB' : '#3B82F6'}
          />
        </Pressable>

        {/* Gallery & Microphone buttons */}
        {!hasText && (
          <View
            style={{
              flexDirection: 'row',
              gap: 8,
            }}>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
              onPress={onPickImage}
              disabled={sendingMessage}
              accessibilityRole="button"
              accessibilityLabel="Pick image"
              accessibilityHint="Opens library to pick an image">
              <Ionicons
                name="image-outline"
                size={24}
                color={sendingMessage ? '#D1D5DB' : '#3B82F6'}
              />
            </Pressable>
            <Pressable
              className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
              onPress={onPickAudio}
              disabled={sendingMessage}
              accessibilityRole="button"
              accessibilityLabel="Pick audio"
              accessibilityHint="Opens library to pick audio">
              <Ionicons
                name="mic-outline"
                size={24}
                color={sendingMessage ? '#D1D5DB' : '#3B82F6'}
              />
            </Pressable>
          </View>
        )}

        {/* Text input */}
        <View className="flex-1 rounded-full bg-gray-100 border border-gray-200 px-4">
          <TextInput
            ref={inputRef}
            className="py-2 text-base text-gray-900"
            placeholder="Message..."
            placeholderTextColor="#9CA3AF"
            value={messageText}
            onChangeText={onChangeText}
            editable={!sendingMessage}
            multiline
            maxLength={1000}
            blurOnSubmit={false}
            autoCapitalize="sentences"
            style={{
              minHeight: 40,
              maxHeight: 100,
            }}
            accessibilityRole="text"
            accessibilityLabel="Message input"
            accessibilityHint="Type your message here"
          />
        </View>

        {/* Send or Like button */}
        {hasText ? (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full active:bg-blue-100"
            onPress={onSend}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel={sendingMessage ? 'Sending message' : 'Send message'}
            accessibilityHint="Double tap to send message">
            <Ionicons
              name={sendingMessage ? 'hourglass-outline' : 'send'}
              size={20}
              color={canSend ? '#3B82F6' : '#D1D5DB'}
            />
          </Pressable>
        ) : (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full active:bg-red-100"
            onPress={() => {}}
            disabled={sendingMessage}
            accessibilityRole="button"
            accessibilityLabel="Send like">
            <Ionicons
              name="heart-outline"
              size={24}
              color={sendingMessage ? '#D1D5DB' : '#EF4444'}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
