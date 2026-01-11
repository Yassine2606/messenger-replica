import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts';
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
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const hasText = messageText.trim().length > 0;
  const canSend = hasText && !sendingMessage;
  const showExpandedUI = hasText && isComposerExpanded;

  return (
    <View
      style={{
        backgroundColor: colors.bg.primary,
        borderTopColor: colors.border.primary,
        paddingBottom: insets.bottom,
        paddingTop: 8,
      }}
      className="border-t">
      {/* Reply indicator */}
      {replyToMessage && (
        <View
          style={{
            backgroundColor: `${colors.primary}15`,
            borderLeftColor: colors.primary,
          }}
          className="mx-3 mb-2 flex-row items-center rounded-xl px-3 py-2 border-l-4">
          <View className="flex-1">
            <Text style={{ color: colors.primary }} className="text-xs font-semibold">
              Replying to {replyToMessage.sender?.name || 'User'}
            </Text>
            <View className="mt-1 flex-row items-center">
              {replyToMessage.type === 'image' ? (
                <>
                  <Ionicons name="image" size={16} color={colors.text.secondary} />
                  <Text style={{ color: colors.text.primary }} className="ml-1 text-sm">
                    Photo
                  </Text>
                </>
              ) : replyToMessage.type === 'audio' ? (
                <>
                  <Ionicons name="mic" size={16} color={colors.text.secondary} />
                  <Text style={{ color: colors.text.primary }} className="ml-1 text-sm">
                    Audio
                  </Text>
                </>
              ) : (
                <Text style={{ color: colors.text.primary }} className="text-sm" numberOfLines={1}>
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
            <Ionicons name="close" size={20} color={colors.primary} />
          </Pressable>
        </View>
      )}

      {/* Input controls */}
      <View className="flex-row items-center px-3 gap-2">
        {/* Camera button or Collapse chevron */}
        {!showExpandedUI ? (
          <Pressable
            style={{ backgroundColor: colors.bg.secondary }}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
            onPress={onTakePhoto}
            disabled={sendingMessage}
            accessibilityRole="button"
            accessibilityLabel="Take photo"
            accessibilityHint="Opens camera to take a photo">
            <Ionicons
              name="camera-outline"
              size={24}
              color={sendingMessage ? colors.text.tertiary : colors.primary}
            />
          </Pressable>
        ) : (
          <Pressable
            style={{ backgroundColor: colors.bg.secondary }}
            className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
            onPress={() => setIsComposerExpanded(false)}
            disabled={sendingMessage}
            accessibilityRole="button"
            accessibilityLabel="Collapse composer"
            accessibilityHint="Collapse the message composer">
            <Ionicons
              name="chevron-forward"
              size={24}
              color={sendingMessage ? colors.text.tertiary : colors.primary}
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
              style={{ backgroundColor: colors.bg.secondary }}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              onPress={onPickImage}
              disabled={sendingMessage}
              accessibilityRole="button"
              accessibilityLabel="Pick image"
              accessibilityHint="Opens library to pick an image">
              <Ionicons
                name="image-outline"
                size={24}
                color={sendingMessage ? colors.text.tertiary : colors.primary}
              />
            </Pressable>
            <Pressable
              style={{ backgroundColor: colors.bg.secondary }}
              className="h-10 w-10 items-center justify-center rounded-full active:opacity-70"
              onPress={onPickAudio}
              disabled={sendingMessage}
              accessibilityRole="button"
              accessibilityLabel="Pick audio"
              accessibilityHint="Opens library to pick audio">
              <Ionicons
                name="mic-outline"
                size={24}
                color={sendingMessage ? colors.text.tertiary : colors.primary}
              />
            </Pressable>
          </View>
        )}

        {/* Text input */}
        <View
          style={{
            backgroundColor: colors.input.bg,
            borderColor: colors.input.border,
          }}
          className="flex-1 rounded-full border px-4">
          <TextInput
            ref={inputRef}
            style={{
              color: colors.input.text,
              minHeight: 40,
              maxHeight: 100,
              paddingVertical: 8,
            }}
            className="text-base"
            placeholder="Message..."
            placeholderTextColor={colors.input.placeholder}
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
            accessibilityRole="text"
            accessibilityLabel="Message input"
            accessibilityHint="Type your message here"
          />
        </View>

        {/* Send button */}
        <Pressable
          style={{ opacity: canSend ? 1 : 0.5 }}
          className="h-10 px-3 items-center justify-center rounded-full active:opacity-70"
          onPress={onSend}
          disabled={!canSend}
          accessibilityRole="button"
          accessibilityLabel={sendingMessage ? 'Sending message' : 'Send message'}
          accessibilityHint="Double tap to send message">
          {sendingMessage ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={{ color: canSend ? colors.primary : colors.text.tertiary }} className="text-sm font-semibold">
              Send
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}
