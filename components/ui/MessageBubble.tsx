import React, { memo, useCallback, useRef, useMemo, useEffect } from 'react';
import { Text, View, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  SharedValue,
  interpolateColor,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Message } from '@/models';
import { GESTURE, ANIMATION, MESSAGE } from '@/lib/chat-constants';
import { ReplyIndicator } from './ReplyIndicator';
import { AudioWavePlayer } from './AudioWavePlayer';
import { scheduleOnRN } from 'react-native-worklets';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '');

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  previousMessage?: Message;
  nextMessage?: Message;
  onReply?: (message: Message) => void;
  onShowMenu?: (coordinates: BubbleCoordinates | null) => void;
  onImagePress?: (imageUri: string) => void;
  onScrollToReply?: (message: Message) => void;
  // Shared animated values for synchronized timestamp drag across all messages of one side
  sharedRowTranslateX?: SharedValue<number>;
  sharedTimestampOpacity?: SharedValue<number>;
}

interface BubbleCoordinates {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
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
  return Math.abs(d1 - d2) < MESSAGE.GROUPING_TIME_THRESHOLD;
}

function getBorderRadius(
  isOwn: boolean,
  isGroupedWithPrevious: boolean,
  isGroupedWithNext: boolean
) {
  const baseRadius = MESSAGE.BORDER_RADIUS_BASE;
  const tightRadius = MESSAGE.BORDER_RADIUS_TIGHT;

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

function MessageBubbleComponent({
  message,
  isOwn,
  previousMessage,
  nextMessage,
  onReply,
  onShowMenu,
  onImagePress,
  onScrollToReply,
  sharedRowTranslateX: propsSharedRowTranslateX,
  sharedTimestampOpacity: propsSharedTimestampOpacity,
}: MessageBubbleProps) {
  // Use provided shared values, or fallback to local ones if not provided
  const localRowTranslateX = useSharedValue(0);
  const localTimestampOpacity = useSharedValue(0);
  
  const sharedRowTranslateX = propsSharedRowTranslateX || localRowTranslateX;
  const sharedTimestampOpacity = propsSharedTimestampOpacity || localTimestampOpacity;

  // Bubble-level gesture (reply) - affects bubble only
  const bubbleTranslateX = useSharedValue(0);
  const replyIconOpacity = useSharedValue(0);

  const bubbleRef = useRef<View>(null);

  const { isGroupedWithPrevious, isGroupedWithNext, borderRadiusStyle } = useMemo(() => {
    const prev =
      isSameSender(previousMessage, message) &&
      isWithinMinute(previousMessage?.createdAt, message.createdAt);

    const next =
      isSameSender(message, nextMessage) && isWithinMinute(message.createdAt, nextMessage?.createdAt);

    return {
      isGroupedWithPrevious: prev,
      isGroupedWithNext: next,
      borderRadiusStyle: getBorderRadius(isOwn, prev, next),
    };
  }, [message.id, isOwn, previousMessage?.id, nextMessage?.id]);

  const handleReply = useCallback(() => {
    if (onReply) {
      onReply(message);
    }
  }, [message, onReply]);

  // GESTURE 1: Row-level gesture for timestamp reveal (shared across all messages on one side)
  const rowGesture = Gesture.Pan()
    .enabled(!message.isDeleted)
    .activeOffsetX([-GESTURE.ACTIVE_OFFSET_X, GESTURE.ACTIVE_OFFSET_X])
    .onUpdate((event) => {
      // Both sides: drag LEFT (negative) to reveal timestamp
      if (event.translationX < 0) {
        const maxDrag = GESTURE.MAX_TIMESTAMP_DRAG;
        sharedRowTranslateX.value = Math.max(event.translationX, -maxDrag);
        sharedTimestampOpacity.value = Math.min(Math.abs(event.translationX) / maxDrag, 1);
      }
    })
    .onEnd(() => {
      // Snap back on release
      sharedRowTranslateX.value = withTiming(0, { duration: ANIMATION.GESTURE_SNAP_BACK });
      sharedTimestampOpacity.value = withTiming(0, { duration: ANIMATION.GESTURE_SNAP_TIMING });
    });

  // GESTURE 2: Bubble-level gesture for reply (higher priority)
  // Own messages: swipe LEFT only
  // Opposite messages: swipe RIGHT only
  const bubbleGesture = Gesture.Pan()
    .enabled(!message.isDeleted)
    .activeOffsetX([-GESTURE.ACTIVE_OFFSET_X, GESTURE.ACTIVE_OFFSET_X])
    .activeOffsetY([-GESTURE.ACTIVE_OFFSET_Y, GESTURE.ACTIVE_OFFSET_Y])
    .onUpdate((event) => {
      const direction = isOwn ? -1 : 1;
      if ((isOwn && event.translationX < 0) || (!isOwn && event.translationX > 0)) {
        bubbleTranslateX.value = direction * Math.min(Math.abs(event.translationX), GESTURE.MAX_REPLY_SWIPE);
        replyIconOpacity.value = Math.min(Math.abs(event.translationX) / GESTURE.MAX_REPLY_SWIPE, 1);
      }
    })
    .onEnd((event) => {
      const isValidSwipeDirection = (isOwn && event.translationX < 0) || (!isOwn && event.translationX > 0);
      if (isValidSwipeDirection && Math.abs(event.translationX) > GESTURE.REPLY_SWIPE_THRESHOLD) {
        scheduleOnRN(handleReply);
      }
      bubbleTranslateX.value = withTiming(0, { duration: ANIMATION.GESTURE_SNAP_TIMING });
      replyIconOpacity.value = withTiming(0, { duration: ANIMATION.GESTURE_SNAP_TIMING });
    })
    .simultaneousWithExternalGesture(Gesture.LongPress());

  // Long press handler: measure bubble and notify parent
  const handleLongPress = useCallback(() => {
    if (message.isDeleted) return;

    bubbleRef.current?.measure((x, y, width, height, pageX, pageY) => {
      // Trigger haptics
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

      // Emit coordinates to parent for overlay positioning
      onShowMenu?.({
        pageX,
        pageY,
        width,
        height,
      });
    });
  }, [message.isDeleted, message.id, onShowMenu]);

  // Row-level animated style (for timestamp reveal)
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: sharedRowTranslateX.value }],
  }));

  // Bubble-level animated style (for reply swipe)
  const bubbleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleTranslateX.value }],
  }));

  const replyIconAnimatedStyle = useAnimatedStyle(() => ({
    opacity: replyIconOpacity.value,
  }));

  const timestampAnimatedStyle = useAnimatedStyle(() => ({
    opacity: sharedTimestampOpacity.value,
  }));

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
    <View style={{ marginBottom: 4 }}>
      {/* Row-level gesture detector - wraps the entire row */}
      <GestureDetector gesture={rowGesture}>
        <Animated.View 
          style={rowAnimatedStyle}
          className={`relative flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
          
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

          {/* Message bubble with long press for actions and swipe for reply */}
          <Pressable
            ref={bubbleRef}
            onLongPress={handleLongPress}
            delayLongPress={300}
            disabled={message.isDeleted}>
            <GestureDetector gesture={bubbleGesture}>
              <Animated.View style={bubbleAnimatedStyle}>
                <ReplyIndicator message={message} isOwn={isOwn} onPress={() => onScrollToReply?.(message)} />
                {message.type === 'image' && message.mediaUrl ? (
                  <Animated.View className="max-w-[280px] overflow-hidden rounded-2xl">
                    <Pressable onPress={() => onImagePress?.(message.mediaUrl!)}>
                      <Image
                        source={{ uri: `${API_BASE_URL}${message.mediaUrl}` }}
                        style={{ width: 200, height: 200, borderRadius: 12 }}
                        contentFit="cover"
                      />
                    </Pressable>
                    {message.content && (
                      <View className={`mt-1 rounded-2xl px-3 py-2 ${isOwn ? 'bg-blue-500' : 'bg-gray-200'}`}>
                        <Text className={`text-base leading-5 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                          {message.content}
                        </Text>
                      </View>
                    )}
                  </Animated.View>
                ) : (
                  <View
                    className={`max-w-[280px] px-3 py-2 ${isOwn ? 'bg-blue-500' : 'bg-gray-200'}`}
                    style={borderRadiusStyle}>
                    {message.type === 'text' && (
                      <Text className={`text-base leading-6 ${isOwn ? 'text-white' : 'text-gray-900'}`}>
                        {message.content}
                      </Text>
                    )}

                    {message.type === 'audio' && message.mediaUrl && (
                      <View className="max-w-[320px]">
                        <AudioWavePlayer
                          audioUrl={`${API_BASE_URL}${message.mediaUrl}`}
                          waveform={message.waveform || []}
                          duration={message.mediaDuration || 0}
                        />
                      </View>
                    )}
                  </View>
                )}
              </Animated.View>
            </GestureDetector>
          </Pressable>

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
    </View>
  );
}

export const MessageBubble = memo(MessageBubbleComponent, (prevProps, nextProps) => {
  // Fast bailout: same reference
  if (prevProps.message === nextProps.message) return true;

  // Custom comparison - avoid expensive JSON.stringify
  const messageEqual =
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.isDeleted === nextProps.message.isDeleted &&
    prevProps.message.reads?.length === nextProps.message.reads?.length &&
    (prevProps.message.reads?.length === 0 ||
     prevProps.message.reads?.some((read) =>
       !nextProps.message.reads?.some((r) => r.userId === read.userId)
     ) === false);

  return (
    messageEqual &&
    prevProps.isOwn === nextProps.isOwn &&
    prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id
  );
});
