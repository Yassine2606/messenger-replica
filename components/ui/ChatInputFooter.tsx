import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
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
 * - Chevron icon when composer is expanded
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
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const hasText = messageText.trim().length > 0;
  const canSend = hasText && !sendingMessage;
  const showExpandedUI = hasText && isComposerExpanded;

  return (
    <View
      className="bg-white border-t border-gray-100"
      style={{
        paddingBottom: insets.bottom,
        paddingTop: 8,
      }}>
      {/* Reply indicator */}
      {replyToMessage && (
        <View className="mx-3 mb-2 flex-row items-center rounded-xl bg-blue-50 px-3 py-2 border-l-4 border-blue-500">
          <View className="flex-1">
            <Text className="text-xs font-semibold text-blue-600">
              Replying to {replyToMessage.sender?.name || 'User'}
            </Text>
            <View className="mt-1 flex-row items-center">
              {replyToMessage.type === 'image' ? (
                <>
                  <Ionicons name="image" size={16} color="#6B7280" />
                  <Text className="ml-1 text-sm text-gray-800">Photo</Text>
                </>
              ) : replyToMessage.type === 'audio' ? (
                <>
                  <Ionicons name="mic" size={16} color="#6B7280" />
                  <Text className="ml-1 text-sm text-gray-800">Audio</Text>
                </>
              ) : (
                <Text className="text-sm text-gray-800" numberOfLines={1}>
                  {replyToMessage.content || 'Message'}
                </Text>
              )}
            </View>
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
        {/* Camera button or Collapse chevron */}
        {!showExpandedUI ? (
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
        ) : (
          <Pressable
            className="h-10 w-10 items-center justify-center rounded-full active:bg-gray-100"
            onPress={() => setIsComposerExpanded(false)}
            disabled={sendingMessage}
            accessibilityRole="button"
            accessibilityLabel="Collapse composer"
            accessibilityHint="Collapse the message composer">
            <Ionicons
              name="chevron-forward"
              size={24}
              color={sendingMessage ? '#D1D5DB' : '#3B82F6'}
            />
          </Pressable>
        )}

        {/* Gallery & Microphone buttons */}
        {!showExpandedUI && (
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
            onChangeText={(text) => {
              onChangeText(text);
              if (text.trim().length > 0) {
                setIsComposerExpanded(true);
              }
            }}
            onSubmitEditing={onSend}
            multiline
            maxLength={1000}
            submitBehavior="submit"
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

        {/* Send button */}
        <Pressable
          className={`h-10 px-3 items-center justify-center rounded-full ${
            canSend ? 'active:bg-blue-100' : ''
          }`}
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sendingMessage ? 'Sending message' : 'Send message'}
          accessibilityHint="Double tap to send message">
          {sendingMessage ? (
            <ActivityIndicator size="small" color="#3B82F6" />
          ) : (
            <Text
              className={`text-sm font-semibold ${
                canSend ? 'text-blue-500' : 'text-gray-300'
              }`}>
              Send
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
