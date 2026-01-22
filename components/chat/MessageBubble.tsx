import React, { useCallback, useRef, useMemo } from 'react';
import { Text, View, Pressable, Platform } from 'react-native';
import { Image } from 'expo-image';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  SharedValue,
  runOnJS,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { Message } from '@/models';
import { GESTURE, ANIMATION, MESSAGE } from '@/lib/chat-constants';
import { formatTimeShort } from '@/lib/time-utils';
import { ReplyIndicator } from './ReplyIndicator';
import { UserAvatar } from '../user';
import { scheduleOnRN } from 'react-native-worklets';
import { useTheme } from '@/contexts';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '');

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  previousMessage?: Message;
  nextMessage?: Message;
  showTimeSeparator?: boolean; // Whether a time separator appears before this message
  onReply?: (message: Message) => void;
  onShowMenu?: (coordinates: BubbleCoordinates | null) => void;
  onContextMenu?: (message: Message, coordinates?: { pageX: number; pageY: number }) => void;
  onImagePress?: (
    imageUri: string,
    layout?: { x: number; y: number; width: number; height: number }
  ) => void;
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



function isSameSender(msg1?: Message, msg2?: Message): boolean {
  return msg1?.senderId === msg2?.senderId;
}

function isWithinMinute(
  date1: number | Date | string | undefined,
  date2: number | Date | string | undefined
): boolean {
  if (date1 == null || date2 == null) return false;

  const toMs = (d: number | Date | string) => {
    if (typeof d === 'number') return d;
    if (typeof d === 'string') return Date.parse(d);
    return d instanceof Date ? d.getTime() : Date.parse(String(d));
  };

  const d1 = toMs(date1);
  const d2 = toMs(date2);
  return Math.abs(d1 - d2) < MESSAGE.GROUPING_TIME_THRESHOLD;
}

function getBorderRadius(
  isOwn: boolean,
  isGroupedWithPrevious: boolean,
  isGroupedWithNext: boolean,
  hasTimeSeparatorAbove?: boolean
) {
  const baseRadius = MESSAGE.BORDER_RADIUS_BASE;
  const tightRadius = MESSAGE.BORDER_RADIUS_TIGHT;

  // If time separator is above, don't group at top (reset top radius to base)
  const effectiveGroupedWithPrevious = isGroupedWithPrevious && !hasTimeSeparatorAbove;

  if (isOwn) {
    if (effectiveGroupedWithPrevious && isGroupedWithNext) {
      return {
        borderTopLeftRadius: baseRadius,
        borderTopRightRadius: tightRadius,
        borderBottomRightRadius: tightRadius,
        borderBottomLeftRadius: baseRadius,
      };
    }
    if (effectiveGroupedWithPrevious) {
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
    if (effectiveGroupedWithPrevious && isGroupedWithNext) {
      return {
        borderTopLeftRadius: tightRadius,
        borderTopRightRadius: baseRadius,
        borderBottomRightRadius: baseRadius,
        borderBottomLeftRadius: tightRadius,
      };
    }
    if (effectiveGroupedWithPrevious) {
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
  showTimeSeparator,
  onReply,
  onShowMenu,
  onContextMenu,
  onImagePress,
  onScrollToReply,
  sharedRowTranslateX: propsSharedRowTranslateX,
  sharedTimestampOpacity: propsSharedTimestampOpacity,
}: MessageBubbleProps) {
  const { colors } = useTheme();

  // Use provided shared values, or fallback to local ones if not provided
  const localRowTranslateX = useSharedValue(0);
  const localTimestampOpacity = useSharedValue(0);

  const sharedRowTranslateX = propsSharedRowTranslateX || localRowTranslateX;
  const sharedTimestampOpacity = propsSharedTimestampOpacity || localTimestampOpacity;

  // Bubble-level gesture (reply) - affects bubble only
  const bubbleTranslateX = useSharedValue(0);
  const replyIconOpacity = useSharedValue(0);

  const bubbleRef = useRef<View>(null);
  const imageLayoutRef = useRef<View | null>(null);

  const { isGroupedWithPrevious, isGroupedWithNext, borderRadiusStyle } = useMemo(() => {
    const prev =
      isSameSender(previousMessage, message) &&
      isWithinMinute(previousMessage?.createdAtMs ?? previousMessage?.createdAt, message.createdAtMs ?? message.createdAt);

    const next =
      isSameSender(message, nextMessage) &&
      isWithinMinute(message.createdAtMs ?? message.createdAt, nextMessage?.createdAtMs ?? nextMessage?.createdAt);

    return {
      isGroupedWithPrevious: prev,
      isGroupedWithNext: next,
      borderRadiusStyle: getBorderRadius(isOwn, prev, next, showTimeSeparator),
    };
  }, [message.id, isOwn, previousMessage?.id, nextMessage?.id, showTimeSeparator]);

  // Memoized styles to reduce allocations on each render
  const bubbleBaseStyle = useMemo(
    () => ({ backgroundColor: isOwn ? colors.bubble.own.bg : colors.bubble.other.bg }),
    [isOwn, colors.bubble?.own?.bg, colors.bubble?.other?.bg]
  );
  const bubbleTextColor = useMemo(
    () => (isOwn ? colors.bubble.own.text : colors.bubble.other.text),
    [isOwn, colors.bubble?.own?.text, colors.bubble?.other?.text]
  );

  const handleReply = useCallback(() => {
    if (onReply) {
      onReply(message);
    }
  }, [message, onReply]);

  // GESTURE 1: Row-level gesture for timestamp reveal (memoized)
  const rowGesture = useMemo(() => {
    return Gesture.Pan()
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
  }, [message.isDeleted, sharedRowTranslateX, sharedTimestampOpacity, isOwn]);

  // GESTURE 2: Bubble-level gesture for reply (memoized)
  const bubbleGesture = useMemo(() => {
    return Gesture.Pan()
      .enabled(!message.isDeleted)
      .activeOffsetX([-GESTURE.ACTIVE_OFFSET_X, GESTURE.ACTIVE_OFFSET_X])
      .activeOffsetY([-GESTURE.ACTIVE_OFFSET_Y, GESTURE.ACTIVE_OFFSET_Y])
      .onUpdate((event) => {
        const direction = isOwn ? -1 : 1;
        if ((isOwn && event.translationX < 0) || (!isOwn && event.translationX > 0)) {
          bubbleTranslateX.value =
            direction * Math.min(Math.abs(event.translationX), GESTURE.MAX_REPLY_SWIPE);
          replyIconOpacity.value = Math.min(
            Math.abs(event.translationX) / GESTURE.MAX_REPLY_SWIPE,
            1
          );
        }
      })
      .onEnd((event) => {
        const isValidSwipeDirection =
          (isOwn && event.translationX < 0) || (!isOwn && event.translationX > 0);
        if (isValidSwipeDirection && Math.abs(event.translationX) > GESTURE.REPLY_SWIPE_THRESHOLD) {
          scheduleOnRN(handleReply);
        }
        bubbleTranslateX.value = withTiming(0, { duration: ANIMATION.GESTURE_SNAP_TIMING });
        replyIconOpacity.value = withTiming(0, { duration: ANIMATION.GESTURE_SNAP_TIMING });
      });
  }, [message.isDeleted, isOwn, handleReply]);

  // Handler for long press callback
  const triggerLongPress = useCallback(() => {
    // Trigger haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {
      // Silently fail on unsupported platforms
    });

    // Capture bubble coordinates
    if (bubbleRef.current) {
      bubbleRef.current.measure((x, y, width, height, pageX, pageY) => {
        if (onContextMenu) {
          onContextMenu(message, { pageX, pageY });
        }
      });
    } else if (onContextMenu) {
      onContextMenu(message);
    }
  }, [message, onContextMenu]);

  // GESTURE 3: Long press gesture for context menu (simultaneous with swipe) (memoized)
  const longPressGesture = useMemo(() => {
    return Gesture.LongPress()
      .enabled(!message.isDeleted)
      .minDuration(300)
      .onStart(() => {
        runOnJS(triggerLongPress)();
      });
  }, [message.isDeleted, triggerLongPress]);

  // Combine gestures: long press and swipe should work together
  const combinedBubbleGesture = useMemo(() => Gesture.Simultaneous(longPressGesture, bubbleGesture), [longPressGesture, bubbleGesture]);

  // Row-level animated style (for timestamp reveal - only for own messages)
  const rowAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: isOwn ? sharedRowTranslateX.value : 0 }],
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
        <View
          style={{ backgroundColor: colors.bg.tertiary, ...borderRadiusStyle, minWidth: 64 }}
          className="max-w-[280px] px-3 py-2"
        >
          <View style={{ flexShrink: 1 }}>
            <Text
              style={{ color: colors.text.tertiary, flexWrap: 'wrap' }}
              className="text-base italic leading-6"
            >
              Message deleted
            </Text>
          </View>
        </View>
      </View>
    );
  }

  // Don't render bubble for audio messages - they're rendered separately in the chat screen
  if (message.type === 'audio') {
    return null;
  }

  return (
    <View style={{ marginBottom: 4 }}>
      {/* Row-level gesture detector - wraps the entire row */}
      <GestureDetector gesture={rowGesture}>
        <Animated.View
          style={rowAnimatedStyle}
          className={`relative flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
          {/* Avatar - only show for other people's messages when not grouped with previous */}
          {!isOwn && !isGroupedWithPrevious && (
            <View className="mr-2 justify-end">
              <UserAvatar
                avatarUrl={message.sender?.avatarUrl}
                userName={message.sender?.name}
                size="sm"
              />
            </View>
          )}

          {/* Spacer when avatar is hidden (grouped with previous) */}
          {!isOwn && isGroupedWithPrevious && <View className="mr-2 w-9" />}

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
            <Ionicons name="arrow-undo" size={20} color={colors.text.secondary} />
          </Animated.View>

          {/* Message bubble with gestures for reply and long press for context menu */}
          <GestureDetector gesture={combinedBubbleGesture}>
            <Animated.View style={bubbleAnimatedStyle}>
              <ReplyIndicator
                message={message}
                isOwn={isOwn}
                onPress={() => onScrollToReply?.(message)}
              />
              {message.type === 'image' && message.mediaUrl ? (
                <>
                  <Animated.View
                    ref={imageLayoutRef as any}
                    style={{
                      width: 160,
                      height: 200,
                      borderRadius: 16,
                      overflow: 'hidden',
                    }}
                    collapsable={false}>
                    <Pressable
                      onPress={() => {
                        if (imageLayoutRef.current && 'measure' in imageLayoutRef.current) {
                          (imageLayoutRef.current as any).measure(
                            (
                              x: number,
                              y: number,
                              width: number,
                              height: number,
                              pageX: number,
                              pageY: number
                            ) => {
                              onImagePress?.(message.mediaUrl!, {
                                x: pageX,
                                y: pageY,
                                width,
                                height,
                              });
                            }
                          );
                        } else {
                          onImagePress?.(message.mediaUrl!);
                        }
                      }}
                      style={{ flex: 1 }}>
                      <Image
                        source={{
                          uri: message.mediaUrl.startsWith('http')
                            ? message.mediaUrl
                            : `${API_BASE_URL}${message.mediaUrl}`,
                        }}
                        style={{ flex: 1, width: '100%', height: '100%' }}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={Platform.OS === 'android' ? 0 : 200}
                      />
                    </Pressable>
                  </Animated.View>
                  {message.content && (
                    <View
                      style={[bubbleBaseStyle, { marginTop: 4, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 }]}
                      className="mt-1 rounded-2xl px-3 py-2">
                      <Text
                        style={{ color: bubbleTextColor }}
                        className="text-base leading-5">
                        {message.content}
                      </Text>
                    </View>
                  )} 
                </>
              ) : message.type === 'text' ? (
                <View
                  style={[bubbleBaseStyle, borderRadiusStyle]}
                  className="max-w-[280px] px-3 py-2">
                  <Text
                    style={{ color: bubbleTextColor }}
                    className="text-base leading-6">
                    {message.content}
                  </Text>
                </View>
              ) : null} 
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
            <Text style={{ color: colors.text.tertiary }} className="text-xs">
              {formatTimeShort(message.createdAt)}
            </Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

/**
 * Memoized wrapper for MessageBubble to prevent unnecessary re-renders during scroll.
 * Uses custom comparison to check only message content and key properties.
 */
const MessageBubble = React.memo(MessageBubbleComponent, (prevProps, nextProps) => {
  // Return true if props are equal (NO re-render), false if they differ (re-render)
  return (
    prevProps.message.id === nextProps.message.id &&
    prevProps.message.content === nextProps.message.content &&
    prevProps.message.mediaUrl === nextProps.message.mediaUrl &&
    prevProps.message.isDeleted === nextProps.message.isDeleted &&
    prevProps.message.reads?.length === nextProps.message.reads?.length &&
    prevProps.isOwn === nextProps.isOwn &&
    prevProps.showTimeSeparator === nextProps.showTimeSeparator &&
    prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id
  );
});

MessageBubble.displayName = 'MessageBubble';

export { MessageBubble };
