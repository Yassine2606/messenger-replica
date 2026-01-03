import React from 'react';
import { View, Text, TextInput, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  interpolate,
  Extrapolate
} from 'react-native-reanimated';
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

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

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
  const sendButtonScale = useSharedValue(1);
  const actionButtonsOpacity = useSharedValue(1);
  const actionButtonsWidth = useSharedValue(74); // 2 buttons (36 each) + gap (8) - initial width
  
  const hasText = messageText.trim().length > 0;
  const canSend = hasText && !sendingMessage;

  // Animate buttons based on text input
  React.useEffect(() => {
    if (hasText) {
      sendButtonScale.value = withTiming(1, { duration: 200 });
      actionButtonsOpacity.value = withTiming(0, { duration: 150 });
      actionButtonsWidth.value = withTiming(0, { duration: 200 });
    } else {
      sendButtonScale.value = withTiming(1, { duration: 200 });
      actionButtonsOpacity.value = withTiming(1, { duration: 200 });
      actionButtonsWidth.value = withTiming(74, { duration: 200 });
    }
  }, [hasText]);

  const sendButtonStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendButtonScale.value }],
    opacity: hasText ? 1 : 0,
    width: hasText ? 36 : 0,
  }));

  const actionButtonsStyle = useAnimatedStyle(() => ({
    opacity: actionButtonsOpacity.value,
    width: actionButtonsWidth.value,
    overflow: 'hidden',
    transform: [
      { 
        translateX: interpolate(
          actionButtonsOpacity.value,
          [0, 1],
          [-20, 0],
          Extrapolate.CLAMP
        )
      }
    ],
  }));

  const likeButtonStyle = useAnimatedStyle(() => ({
    opacity: hasText ? 0 : 1,
    width: hasText ? 0 : 36,
    transform: [{ scale: hasText ? 0 : 1 }],
  }));

  return (
    <View
      className="bg-white border-t border-gray-100"
      style={{ 
        paddingBottom: Math.max(insets.bottom, 8),
        paddingTop: 8,
      }}>
      {replyToMessage && (
        <View className="mx-3 mb-2 flex-row items-center rounded-xl bg-gray-50 px-3 py-2 border-l-2 border-blue-500">
          <View className="flex-1">
            <Text className="text-xs font-semibold text-gray-600">
              Replying to {replyToMessage.sender?.name || 'User'}
            </Text>
            <Text className="mt-0.5 text-sm text-gray-800" numberOfLines={1}>
              {replyToMessage.type === 'image'
                ? '📷 Photo'
                : replyToMessage.type === 'audio'
                  ? '🎵 Audio'
                  : replyToMessage.content || 'Message'}
            </Text>
          </View>
          <Pressable 
            onPress={onCancelReply}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Ionicons name="close-circle" size={20} color="#9CA3AF" />
          </Pressable>
        </View>
      )}
      
      <View className="flex-row items-center px-3 gap-2">
        {/* Camera Button */}
        <Pressable 
          className="h-9 w-9 items-center justify-center"
          onPress={onTakePhoto}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="camera-outline" size={26} color="#3B82F6" />
        </Pressable>

        {/* Gallery & Microphone Buttons - Hide when typing */}
        <Animated.View style={[actionButtonsStyle, { flexDirection: 'row', gap: 8 }]}>
          <Pressable 
            className="h-9 w-9 items-center justify-center"
            onPress={onPickImage}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={hasText}
            pointerEvents={hasText ? 'none' : 'auto'}>
            <Ionicons name="image-outline" size={24} color="#3B82F6" />
          </Pressable>
          <Pressable 
            className="h-9 w-9 items-center justify-center"
            onPress={onPickAudio}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            disabled={hasText}
            pointerEvents={hasText ? 'none' : 'auto'}>
            <Ionicons name="mic-outline" size={24} color="#3B82F6" />
          </Pressable>
        </Animated.View>

        {/* Input Container */}
        <View className="flex-1 rounded-3xl bg-gray-100 border border-gray-200">
          <TextInput
            ref={inputRef}
            className="max-h-24 px-4 py-2 text-base text-gray-900"
            placeholder="Message..."
            placeholderTextColor="#9CA3AF"
            value={messageText}
            onChangeText={onChangeText}
            multiline
            maxLength={1000}
            editable={!sendingMessage}
            autoCapitalize="sentences"
            style={{ minHeight: 36 }}
            blurOnSubmit={false}
          />
        </View>

        {/* Send Button - Shows when typing */}
        <AnimatedPressable
          style={[
            {
              height: 36,
              borderRadius: 18,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#3B82F6',
              overflow: 'hidden',
            },
            sendButtonStyle,
          ]}
          onPress={onSend}
          disabled={!canSend}>
          <Ionicons 
            name={sendingMessage ? "hourglass-outline" : "send"} 
            size={18} 
            color="white" 
            style={{ marginLeft: 2 }} 
          />
        </AnimatedPressable>

        {/* Like Button - Shows when not typing */}
        <AnimatedPressable
          style={[
            {
              height: 36,
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            },
            likeButtonStyle,
          ]}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="heart-outline" size={26} color="#3B82F6" />
        </AnimatedPressable>
      </View>
    </View>
  );
}
