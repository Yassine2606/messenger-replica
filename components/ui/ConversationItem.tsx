import { memo } from 'react';
import { Text, View } from 'react-native';
import type { Conversation } from '@/models';
import { useUserPresence } from '@/hooks';
import { formatTimeAgo, shouldShowOnlineIndicator } from '@/lib/time-utils';

interface ConversationItemProps {
  conversation: Conversation;
  currentUserId?: number;
}

function formatTime(date?: Date | string): string {
  if (!date) return '';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: false });
}

function ConversationItemComponent({ conversation, currentUserId }: ConversationItemProps) {
  const otherParticipant = conversation.participants?.find((p) => p.id !== currentUserId);
  // Get real-time presence from store with fallback to conversation data
  // Only call if participant exists to avoid looking up userId=0
  const realtimeLastSeen = otherParticipant 
    ? useUserPresence(otherParticipant.id, otherParticipant.lastSeen)
    : undefined;
  
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
    <View className={`flex-row items-stretch border-b border-gray-100 px-4 py-3 ${hasUnread ? 'bg-blue-50' : 'bg-white'}`}>
      {/* Avatar */}
      <View className="mr-3 relative justify-center">
        <View className="h-12 w-12 items-center justify-center rounded-full bg-blue-500">
          <Text className="text-lg font-semibold text-white">
            {otherParticipant?.name?.charAt(0).toUpperCase() || '?'}
          </Text>
        </View>
        {shouldShowStatus && (
          <View className="absolute bottom-0 right-0 items-center justify-center">
            {statusText === 'Online' ? (
              <View className="h-3 w-3 rounded-full border-2 border-white bg-green-500" />
            ) : (
                <View className="rounded-full border border-gray-300 bg-white px-0.5 py-0.5">
                <Text className="text-xs font-medium text-gray-600">
                  {statusText}
                </Text>
                </View>
            )}
          </View>
        )}
      </View>

      {/* Content */}
      <View className="flex-1">
        {/* Header: Name + Time */}
        <View className="flex-row items-center justify-between">
          <Text className="text-base font-semibold text-gray-900 flex-1 pr-2" numberOfLines={1}>
            {otherParticipant?.name || 'Unknown'}
          </Text>
          <Text className={`text-xs ${hasUnread ? 'font-semibold text-gray-700' : 'text-gray-500'} flex-shrink-0`}>
            {formatTime(lastMessage?.createdAt)}
          </Text>
        </View>

        {/* Footer: Message preview + Status + Unread indicator */}
        <View className="mt-1.5 flex-row items-center justify-between">
          <Text
            className={`flex-1 text-sm ${hasUnread ? 'font-semibold text-gray-900' : 'text-gray-600'}`}
            numberOfLines={1}>
            {messagePreview}
          </Text>
          <View className="ml-2 flex-row items-center flex-shrink-0">
            {isOwnMessage && status && (
              <Text
                className={`text-xs font-medium mr-1 ${
                  status === 'Read' ? 'text-blue-600' : status === 'Delivered' ? 'text-gray-500' : 'text-gray-400'
                }`}>
                {status}
              </Text>
            )}
            {hasUnread && (
              <View className="h-2.5 w-2.5 rounded-full bg-blue-600" />
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

export const ConversationItem = memo(ConversationItemComponent);
