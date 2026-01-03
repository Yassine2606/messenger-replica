import React, { useState } from 'react';
import { Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS, SharedValue } from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import type { Message } from '@/models';
import { MessageStatus } from './MessageStatus';
import { ImageViewer } from './ImageViewer';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';

interface MessageItemProps {
  message: Message;
  isOwn: boolean;
  isLastOwnMessage?: boolean;
  previousMessage?: Message;
  nextMessage?: Message;
  currentUserId?: number;
  onReply?: (message: Message) => void;
  sharedRowTranslateX: SharedValue<number>;
  sharedTimestampOpacity: SharedValue<number>;
}

function formatTime(date: Date | string | undefined): string {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  return dateObj.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function isSameSender(msg1?: Message, msg2?: Message): boolean {
  return msg1?.senderId === msg2?.senderId;
}

function isWithinMinute(date1: Date | string | undefined, date2: Date | string | undefined): boolean {
  if (!date1 || !date2) return false;
  const d1 = typeof date1 === 'string' ? new Date(date1).getTime() : new Date(date1).getTime();
  const d2 = typeof date2 === 'string' ? new Date(date2).getTime() : new Date(date2).getTime();
  return Math.abs(d1 - d2) < 60000;
}

function getBorderRadius(
  isOwn: boolean,
  isGroupedWithPrevious: boolean,
  isGroupedWithNext: boolean
) {
  const baseRadius = 18;
  const tightRadius = 4;

  if (isOwn) {
    if (isGroupedWithPrevious && isGroupedWithNext) {
      return {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: tightRadius,
        borderBottomRightRadius: tightRadius,
        borderBottomLeftRadius: baseRadius,
      };
    }
    if (isGroupedWithPrevious) {
      return {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: tightRadius,
        borderBottomRightRadius: baseRadius,
        borderBottomLeftRadius: baseRadius,
      };
    }
    if (isGroupedWithNext) {
      return {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: baseRadius,
        borderBottomRightRadius: tightRadius,
        borderBottomLeftRadius: baseRadius,
      };
    }
  } else {
    if (isGroupedWithPrevious && isGroupedWithNext) {
      return {
        borderTopLeftRadius: tightRadius,
        borderTopRightRadius: baseRadius,
        borderBottomRightRadius: baseRadius,
        borderBottomLeftRadius: tightRadius,
      };
    }
    if (isGroupedWithPrevious) {
      return {
        borderTopLeftRadius: tightRadius,
        borderTopRightRadius: baseRadius,
        borderBottomRightRadius: baseRadius,
        borderBottomLeftRadius: baseRadius,
      };
    }
    if (isGroupedWithNext) {
      return {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: baseRadius,
        borderBottomRightRadius: baseRadius,
        borderBottomLeftRadius: tightRadius,
      };
    }
  }
  return { borderRadius: baseRadius };
}

export function MessageItem({
  message,
  isOwn,
  isLastOwnMessage,
  previousMessage,
  nextMessage,
  currentUserId,
  onReply,
  sharedRowTranslateX,
  sharedTimestampOpacity,
}: MessageItemProps) {
  // Image viewer state
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  
  // Bubble-level gesture (reply) - affects bubble only
  const bubbleTranslateX = useSharedValue(0);
  const replyIconOpacity = useSharedValue(0);

  const isGroupedWithPrevious =
    isSameSender(previousMessage, message) &&
    isWithinMinute(previousMessage?.createdAt, message.createdAt);

  const isGroupedWithNext =
    isSameSender(message, nextMessage) && isWithinMinute(message.createdAt, nextMessage?.createdAt);

  const borderRadiusStyle = getBorderRadius(isOwn, isGroupedWithPrevious, isGroupedWithNext);

  const handleReply = () => {
    if (onReply) {
      onReply(message);
    }
  };

  // GESTURE 1: Row-level gesture for timestamp reveal (lower priority)
  // Triggers when dragging outside bubble - moves ALL messages in list together
  const rowGesture = Gesture.Pan()
    .enabled(!message.isDeleted)
    .activeOffsetX([-15, 15])
    .onUpdate((event) => {
      // Row gesture always drags left to reveal timestamp on right
      if (event.translationX < 0) {
        const maxDrag = 80;
        sharedRowTranslateX.value = Math.max(event.translationX, -maxDrag);
        sharedTimestampOpacity.value = Math.min(Math.abs(event.translationX) / maxDrag, 1);
      }
    })
    .onEnd(() => {
      // Snap back on release
      sharedRowTranslateX.value = withTiming(0, { duration: 300 });
      sharedTimestampOpacity.value = withTiming(0, { duration: 200 });
    });

  // GESTURE 2: Bubble-level gesture for reply (higher priority)
  // Only triggers when dragging ON the bubble itself
  const bubbleGesture = Gesture.Pan()
    .enabled(!message.isDeleted)
    .activeOffsetX([-10, 10])
    .onUpdate((event) => {
      const maxSwipe = 60;
      const direction = isOwn ? -1 : 1;
      if ((isOwn && event.translationX < 0) || (!isOwn && event.translationX > 0)) {
        bubbleTranslateX.value = direction * Math.min(Math.abs(event.translationX), maxSwipe);
        replyIconOpacity.value = Math.min(Math.abs(event.translationX) / maxSwipe, 1);
      }
    })
    .onEnd((event) => {
      if (Math.abs(event.translationX) > 40) {
        runOnJS(handleReply)();
      }
      bubbleTranslateX.value = withTiming(0, { duration: 200 });
      replyIconOpacity.value = withTiming(0, { duration: 200 });
    });

  // Animated styles
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sharedRowTranslateX.value }],
  }));

  const bubbleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleTranslateX.value }],
  }));

  const replyIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: replyIconOpacity.value,
  }));

  const timestampAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sharedTimestampOpacity.value,
  }));

  const marginBottom = isGroupedWithNext ? 2 : 8;

  if (message.isDeleted) {
    return (
      <View className={`mb-1 flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <View className="max-w-[75%] rounded-2xl bg-gray-100 px-3 py-2">
          <Text className="text-sm italic text-gray-400">Message deleted</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={{ marginBottom }}>
      {/* Row-level gesture detector - wraps the entire row */}
      <GestureDetector gesture={rowGesture}>
        <Animated.View 
          style={rowAnimatedStyle}
          className={`flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
          
          {/* Reply icon - behind bubble */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                [isOwn ? 'right' : 'left']: 8,
                alignSelf: 'center',
                zIndex: -1,
              },
              replyIconAnimatedStyle,
            ]}
            pointerEvents="none">
            <Ionicons name="arrow-undo" size={20} color="#9CA3AF" />
          </Animated.View>

          {/* Message bubble with bubble-level gesture */}
          <GestureDetector gesture={bubbleGesture}>
            <Animated.View style={bubbleAnimatedStyle}>
              {message.type === 'image' && message.mediaUrl ? (
                // Image without bubble background
                <View className="max-w-[280px]">
                  {message.replyTo && !message.replyTo.isDeleted && (
                    <View className={`mb-2 px-3 py-2 rounded-2xl border-l-2 pl-2 ${isOwn ? 'bg-blue-500 border-blue-300' : 'bg-gray-200 border-gray-400'}`}>
                      <Text className={`text-xs font-medium ${isOwn ? 'text-blue-100' : 'text-gray-600'}`}>
                        {message.replyTo.sender?.name || 'User'}
                      </Text>
                      <Text
                        className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}
                        numberOfLines={2}>
                        {message.replyTo.type === 'image'
                          ? '📷 Photo'
                          : message.replyTo.type === 'audio'
                            ? '🎵 Audio'
                            : message.replyTo.content || 'Message'}
                      </Text>
                    </View>
                  )}
                  <Pressable onPress={() => setImageViewerVisible(true)}>
                    <Image
                      source={{ uri: `${API_URL.replace('/api', '')}${message.mediaUrl}` }}
                      style={{ width: 200, height: 200, borderRadius: 12 }}
                      contentFit="cover"
                    />
                  </Pressable>
                  {message.content && (
                    <View className={`mt-1 px-3 py-2 rounded-2xl ${isOwn ? 'bg-blue-500' : 'bg-gray-200'}`}>
                      <Text className={`text-base leading-5 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                        {message.content}
                      </Text>
                    </View>
                  )}
                </View>
              ) : (
                // Text and Audio with bubble background
                <View
                  className={`max-w-[280px] px-3 py-2 ${isOwn ? 'bg-blue-500' : 'bg-gray-200'}`}
                  style={borderRadiusStyle}>
                  {message.replyTo && !message.replyTo.isDeleted && (
                    <View className={`mb-2 border-l-2 pl-2 ${isOwn ? 'border-blue-300' : 'border-gray-400'}`}>
                      <Text className={`text-xs font-medium ${isOwn ? 'text-blue-100' : 'text-gray-600'}`}>
                        {message.replyTo.sender?.name || 'User'}
                      </Text>
                      <Text
                        className={`text-xs ${isOwn ? 'text-blue-200' : 'text-gray-500'}`}
                        numberOfLines={2}>
                        {message.replyTo.type === 'image'
                          ? '📷 Photo'
                          : message.replyTo.type === 'audio'
                            ? '🎵 Audio'
                            : message.replyTo.content || 'Message'}
                      </Text>
                    </View>
                  )}

                  {message.type === 'text' && (
                    <Text className={`text-base leading-5 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                      {message.content}
                    </Text>
                  )}

                  {message.type === 'audio' && message.mediaUrl && (
                    <View className="flex-row items-center gap-2">
                      <Ionicons 
                        name="play-circle" 
                        size={32} 
                        color={isOwn ? 'white' : '#3B82F6'} 
                      />
                      <View className="flex-1">
                        <Text className={`text-sm ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                          Audio message
                        </Text>
                        {message.mediaDuration && (
                          <Text className={`text-xs ${isOwn ? 'text-blue-100' : 'text-gray-500'}`}>
                            {Math.floor(message.mediaDuration / 60)}:{(message.mediaDuration % 60).toString().padStart(2, '0')}
                          </Text>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              )}

              {/* Show status only for the last own message - right aligned */}
              {isOwn && isLastOwnMessage && (
                <View className="mt-1 flex-row justify-end items-center gap-1">
                  <MessageStatus reads={message.reads} currentUserId={currentUserId} />
                </View>
              )}
            </Animated.View>
          </GestureDetector>

          {/* Timestamp - revealed on right when row is dragged left */}
          <Animated.View
            style={[
              {
                position: 'absolute',
                right: -70,
                alignSelf: 'center',
              },
              timestampAnimatedStyle,
            ]}
            pointerEvents="none">
            <Text className="text-xs text-gray-400">
              {formatTime(message.createdAt)}
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>

      {/* Image Viewer Modal */}
      {message.type === 'image' && message.mediaUrl && (
        <ImageViewer
          visible={imageViewerVisible}
          imageUri={`${API_URL.replace('/api', '')}${message.mediaUrl}`}
          onClose={() => setImageViewerVisible(false)}
        />
      )}
    </View>
  );
}
