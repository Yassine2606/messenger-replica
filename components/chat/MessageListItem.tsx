import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { type SharedValue } from 'react-native-reanimated';

import { ErrorBoundary } from '@/components/common';
import {
  MessageBubble,
  TimeSeparator,
  MessageStatus,
} from './';
import { VoiceMessagePlayer } from '@/components/media';
import { Message, MessageType } from '@/models';
import { MESSAGE } from '@/lib/chat-constants';

interface MessageListItemProps {
  item: Message;
  index: number;
  previousMessage?: Message;
  nextMessage?: Message;
  combinedMessages: Message[];
  userId?: number;
  onReply: (message: Message) => void;
  onContextMenu: (message: Message) => void;
  onImagePress?: (imageUri: string, layout?: any) => void;
  onScrollToReply: (message: Message) => void;
  sharedRowTranslateX: SharedValue<number>;
  sharedTimestampOpacity: SharedValue<number>;
}

function MessageListItem({
  item,
  index,
  previousMessage,
  nextMessage,
  combinedMessages,
  userId,
  onReply,
  onContextMenu,
  onImagePress,
  onScrollToReply,
  sharedRowTranslateX,
  sharedTimestampOpacity,
}: MessageListItemProps) {
  const isOwn = item.senderId === userId;

  // Check if this is the last own message (most recent own message)
  // With inverted list: check if no newer own message exists before this one
  const isLastOwnMessage = useMemo(
    () => isOwn && !combinedMessages.slice(0, index).some((msg) => msg.senderId === userId),
    [isOwn, userId, index, combinedMessages]
  );

  // Check if we need to show time separator
  const showTimeSeparator = useMemo(() => {
    if (!previousMessage) return true;

    const currentMs = (item as any).createdAtMs ?? Date.parse(item.createdAt);
    const previousMs = (previousMessage as any).createdAtMs ?? Date.parse(previousMessage.createdAt);

    const dayChanged = new Date(currentMs).toDateString() !== new Date(previousMs).toDateString();
    const longGap = Math.abs(currentMs - previousMs) > MESSAGE.SEPARATOR_TIME_THRESHOLD;

    return dayChanged || longGap;
  }, [item, previousMessage]);

  const apiBaseUrl = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';

  const getAudioUrl = useCallback((mediaUrl: string) => {
    if (mediaUrl.startsWith('http')) return mediaUrl;
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
    return `${baseUrl}${mediaUrl}`.replace('/api/uploads', '/uploads');
  }, []);

  // Stable placeholder for show menu handler to avoid recreating inline functions on each render
  const handleShowMenu = useCallback((coords?: any) => {
    // Intentionally stable noop - message context menu uses `onContextMenu` from parent
  }, []);

  return (
    <ErrorBoundary componentName="MessageBubble">
      <View>
        {showTimeSeparator && <TimeSeparator date={item.createdAt} />}
        <MessageBubble
          message={item}
          previousMessage={previousMessage}
          nextMessage={nextMessage}
          showTimeSeparator={showTimeSeparator}
          isOwn={isOwn}
          onReply={onReply}
          onShowMenu={handleShowMenu}/>
        {/* Audio player - rendered separately with width constraint */}
        {item.type === MessageType.AUDIO && item.mediaUrl && (
          <View className={`mt-1 flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
            <VoiceMessagePlayer
              audioUrl={getAudioUrl(item.mediaUrl)}
              waveform={item.waveform || []}
              duration={item.mediaDuration || 0}
              isOwn={isOwn}
              message={item}
              previousMessage={previousMessage}
              nextMessage={nextMessage}
              onContextMenu={onContextMenu}
            />
          </View>
        )}
        
        {/* Message status - only for last own message */}
        {isLastOwnMessage && (
          <View className="mt-1 flex-row items-center justify-end gap-1 pr-1">
            <MessageStatus reads={item.reads} currentUserId={userId} />
          </View>
        )}
      </View>
    </ErrorBoundary>
  );
}

// Memoize MessageListItem with a focused comparison to avoid re-renders while scrolling
const MemoizedMessageListItem = React.memo(MessageListItem, (prevProps, nextProps) => {
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.content === nextProps.item.content &&
    prevProps.item.mediaUrl === nextProps.item.mediaUrl &&
    prevProps.item.isDeleted === nextProps.item.isDeleted &&
    (prevProps.item.reads?.length || 0) === (nextProps.item.reads?.length || 0) &&
    prevProps.userId === nextProps.userId &&
    prevProps.index === nextProps.index &&
    prevProps.previousMessage?.id === nextProps.previousMessage?.id &&
    prevProps.nextMessage?.id === nextProps.nextMessage?.id
  );
});

MemoizedMessageListItem.displayName = 'MessageListItem';

export { MemoizedMessageListItem as MessageListItem };
