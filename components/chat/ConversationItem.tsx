import { Text, View } from 'react-native';
import React from 'react';
import { useTheme } from '@/contexts';
import type { Conversation } from '@/models';
import { formatTimeAgo, shouldShowOnlineIndicator, formatTimeShort } from '@/lib/time-utils';

import { UserAvatar } from '../user';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId?: number;
  otherUserLastSeen?: string;
}


function ConversationItemComponent({
  conversation,
  currentUserId,
  otherUserLastSeen,
}: ConversationItemProps) {
  const { colors } = useTheme();
  const otherParticipant = conversation.participants?.find((p) => p.id !== currentUserId);

  // Use provided real-time lastSeen or fall back to conversation data
  const realtimeLastSeen = otherUserLastSeen || otherParticipant?.lastSeen;

  const lastMessage = conversation.lastMessage;
  const isOwnMessage = lastMessage?.senderId === currentUserId;

  const getMessagePreview = (): string => {
    if (!lastMessage) return 'No messages yet';
    if (lastMessage.isDeleted) return isOwnMessage ? 'You deleted a message' : 'Message deleted';

    let content = '';
    if (lastMessage.type === 'image') content = 'Sent an image';
    else if (lastMessage.type === 'audio') content = 'Sent an audio';
    else content = lastMessage.content || '';

    return isOwnMessage ? `You: ${content}` : content;
  };

  const getMessageStatus = (): string | null => {
    if (!lastMessage || !isOwnMessage || !lastMessage.reads) return null;

    const otherUserRead = lastMessage.reads.find((read) => read.userId !== currentUserId);
    if (!otherUserRead) return 'Sent';

    if (otherUserRead.status === 'read') return 'Read';
    if (otherUserRead.status === 'delivered') return 'Delivered';
    return 'Sent';
  };

  const hasUnread = (conversation.unreadCount || 0) > 0;
  const status = getMessageStatus();
  const messagePreview = getMessagePreview();

  // Get online status from real-time store
  const statusText = realtimeLastSeen ? formatTimeAgo(realtimeLastSeen) : null;
  const shouldShowStatus = realtimeLastSeen ? shouldShowOnlineIndicator(realtimeLastSeen) : false;
  const isOnline = statusText === 'Online';

  return (
    <View
      style={{
        borderBottomColor: colors.border.primary,
        backgroundColor: hasUnread ? colors.bg.secondary : colors.bg.primary,
      }}
      className="flex-row items-stretch border-b px-4 py-4">
      {/* Avatar */}
      <View className="relative mr-4 justify-center">
        <UserAvatar
          avatarUrl={otherParticipant?.avatarUrl}
          userName={otherParticipant?.name}
          size="lg"
        />
        {shouldShowStatus && (
          <View className="absolute bottom-0 right-0 items-center justify-center">
            {statusText === 'Online' ? (
              <View
                style={{ backgroundColor: colors.status.online, borderColor: colors.bg.primary }}
                className="h-4 w-4 rounded-full border-2"
              />
            ) : (
              <View
                style={{ borderColor: colors.border.primary, backgroundColor: colors.bg.primary }}
                className="rounded-full border px-0.5 py-0.5">
                <Text style={{ color: colors.text.secondary }} className="text-xs font-medium">
                  {statusText}
                </Text>
              </View>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1 justify-center">
        {/* Header: Name + Time */}
        <View className="mb-1.5 flex-row items-center gap-2">
          <Text
            style={{ color: colors.text.primary }}
            className="flex-1 pr-2 text-base font-semibold"
            numberOfLines={1}>
            {otherParticipant?.name || 'Unknown'}
          </Text>
          <Text
            style={{ color: hasUnread ? colors.text.primary : colors.text.secondary }}
            className={`flex-shrink-0 text-xs ${hasUnread ? 'font-semibold' : ''}`}>
            {formatTimeShort(lastMessage?.createdAt)}
          </Text>
        </View>

        {/* Footer: Message preview + Status/Unread indicator */}
        <View className="flex-row items-center gap-2">
          <Text
            style={{ color: hasUnread ? colors.text.primary : colors.text.secondary }}
            className={`flex-1 text-sm ${hasUnread ? 'font-semibold' : ''}`}
            numberOfLines={1}>
            {messagePreview}
          </Text>

          {/* Status and unread indicator container */}
          <View className="flex-shrink-0 flex-row items-center gap-1.5">
            {isOwnMessage && status && (
              <Text
                style={{
                  color:
                    status === 'Read'
                      ? colors.status.read
                      : status === 'Delivered'
                        ? colors.status.delivered
                        : colors.status.sent,
                }}
                className="text-xs font-medium">
                {status}
              </Text>
            )}
            {hasUnread && (
              <View
                style={{ backgroundColor: colors.primary }}
                className="h-2.5 w-2.5 rounded-full"
              />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export const ConversationItem = React.memo(ConversationItemComponent, (prevProps, nextProps) => {
  // Custom comparison: only re-render if conversation data actually changed
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.conversation.lastMessage?.id === nextProps.conversation.lastMessage?.id &&
    prevProps.conversation.unreadCount === nextProps.conversation.unreadCount &&
    prevProps.otherUserLastSeen === nextProps.otherUserLastSeen
  );
});
