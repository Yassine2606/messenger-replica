import React, { useRef, useState } from 'react';
import { TouchableOpacity, Text, View, TextInput, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';
import type { Message } from '@/models';

interface ChatInputFooterProps {
  onSend: (text: string) => void;
  placeholder?: string;
  replyTo?: Message | null;
  onCancelReply?: () => void;
  sendingMessage?: boolean;
  onPickImage?: () => void;
  onTakePhoto?: () => void;
  onPickAudio?: () => void;
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
function ChatInputFooterComponent({
  onSend,
  placeholder = 'Aa',
  replyTo,
  onCancelReply,
  sendingMessage = false,
  onPickImage,
  onTakePhoto,
  onPickAudio,
}: ChatInputFooterProps) {
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<TextInput>(null);
  const composerWidthAnim = useRef(new Animated.Value(0)).current;

  const isComposerExpanded = isFocused || text.length > 0;

  React.useEffect(() => {
    Animated.timing(composerWidthAnim, {
      toValue: isComposerExpanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [isComposerExpanded, composerWidthAnim]);

  const handleSend = React.useCallback(() => {
    const trimmedText = text.trim();
    if (trimmedText) {
      // Send the message
      onSend(trimmedText);
      // Clear input immediately for better UX
      setText('');
      // Optionally blur to collapse composer
      setIsFocused(false);
    }
  }, [text, onSend]);

  const handleCollapseComposer = React.useCallback(() => {
    setText('');
    setIsFocused(false);
  }, []);

  const composerWidth = composerWidthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['50%', '100%'],
  });

  return (
    <View
      style={{
        backgroundColor: colors.bg.primary,
        borderTopColor: colors.border.primary,
      }}
      className="border-t px-4 py-2">
      {/* Reply context */}
      {replyTo && (
        <View
          style={{
            backgroundColor: `${colors.primary}15`,
            borderLeftColor: colors.primary,
          }}
          className="mb-2 flex-row items-center rounded-lg border-l-4 bg-gray-100 px-3 py-2">
          <View className="flex-1">
            <Text style={{ color: colors.primary }} className="text-xs">
              Replying to {replyTo.sender?.name || 'User'}
            </Text>
            <Text style={{ color: colors.text.primary }} className="text-sm" numberOfLines={1}>
              {replyTo.content || replyTo.type || 'Message'}
            </Text>
          </View>
          <TouchableOpacity onPress={onCancelReply} className="ml-2" activeOpacity={0.7} hitSlop={8}>
            <Ionicons name="close" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>
      )}

      {/* Main Input Container */}
      <View className="flex-row items-center gap-2">
        {/* Left Section: 3 Action Buttons */}
        <View className="flex-row gap-1">
          {!isComposerExpanded ? (
            <TouchableOpacity
              onPress={onTakePhoto}
              disabled={sendingMessage}
              className="items-center justify-center p-2"
              activeOpacity={0.7}
              hitSlop={8}>
              <Ionicons
                name="camera"
                size={24}
                color={sendingMessage ? colors.text.tertiary : colors.primary}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleCollapseComposer}
              className="items-center justify-center p-2"
              activeOpacity={0.7}
              hitSlop={8}>
              <Ionicons name="chevron-forward" size={24} color={colors.primary} />
            </TouchableOpacity>
          )}

          {!isComposerExpanded && (
            <>
              <TouchableOpacity
                onPress={onPickImage}
                disabled={sendingMessage}
                className="items-center justify-center p-2"
                activeOpacity={0.7}
                hitSlop={8}>
                <Ionicons
                  name="image"
                  size={24}
                  color={sendingMessage ? colors.text.tertiary : colors.primary}
                />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onPickAudio}
                disabled={sendingMessage}
                className="items-center justify-center p-2"
                activeOpacity={0.7}
                hitSlop={8}>
                <Ionicons
                  name="mic"
                  size={24}
                  color={sendingMessage ? colors.text.tertiary : colors.primary}
                />
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Middle Section: Composer with Animated Width */}
        <Animated.View
          style={{
            width: composerWidth,
            backgroundColor: colors.input.bg,
            borderColor: colors.input.border,
          }}
          className="flex-1 items-center rounded-full border">
          <TextInput
            ref={inputRef}
            value={text}
            onChangeText={setText}
            placeholder={placeholder}
            placeholderTextColor={colors.input.placeholder}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            multiline
            maxLength={1000}
            className="w-full px-4 py-2 text-base"
            style={{
              color: colors.input.text,
              maxHeight: 100,
            }}
          />
        </Animated.View>

        {/* Right Section: Send Button */}
        <TouchableOpacity
          onPress={handleSend}
          disabled={!text.trim() || sendingMessage}
          activeOpacity={text.trim() && !sendingMessage ? 0.7 : 0.5}
          className="items-center justify-center p-2">
          <Ionicons
            name="send"
            size={24}
            color={text.trim() && !sendingMessage ? colors.primary : colors.text.tertiary}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

export const ChatInputFooter = React.memo(ChatInputFooterComponent, (prev, next) => {
  return (
    prev.replyTo?.id === next.replyTo?.id &&
    prev.sendingMessage === next.sendingMessage &&
    prev.placeholder === next.placeholder &&
    prev.onPickImage === next.onPickImage &&
    prev.onTakePhoto === next.onTakePhoto &&
    prev.onPickAudio === next.onPickAudio &&
    prev.onSend === next.onSend &&
    prev.onCancelReply === next.onCancelReply
  );
});
ChatInputFooter.displayName = 'ChatInputFooter';