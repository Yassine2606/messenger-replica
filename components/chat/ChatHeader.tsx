import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserPresence } from '@/hooks';
import { useTheme } from '@/contexts';
import { formatTimeAgo, shouldShowOnlineIndicator } from '@/lib/time-utils';
import { UserAvatar } from '../user';
import React from 'react';

interface ChatHeaderProps {
  title: string;
  userId?: number;
  lastSeen?: string;
  onBackPress?: () => void;
  onLeavePress?: () => void;
  userName?: string;
  userAvatarUrl?: string;
}

function ChatHeaderComponent({
  title,
  userId,
  lastSeen,
  onBackPress,
  onLeavePress,
  userName,
  userAvatarUrl,
}: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  // Always call the hook, it handles the conditional logic internally
  const realtimeLastSeen = useUserPresence(userId, lastSeen);

  const handleBack = React.useCallback(() => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  }, [onBackPress]);

  const statusText = realtimeLastSeen ? formatTimeAgo(realtimeLastSeen) : null;
  const shouldShow = realtimeLastSeen ? shouldShowOnlineIndicator(realtimeLastSeen) : false;

  return (
    <View
      style={{
        borderBottomColor: colors.border.primary,
        backgroundColor: colors.bg.primary,
      }}
      className="border-b">
      <View className="flex-row items-center px-2 py-3">
        <TouchableOpacity
          onPress={handleBack}
          className="mr-3 h-10 w-10 items-center justify-center"
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={28} color={colors.primary} />
        </TouchableOpacity>

        {/* Avatar */}
        <View className="mr-3">
          <UserAvatar avatarUrl={userAvatarUrl} userName={userName} size="md" />
        </View>

        <View className="flex-1">
          <Text
            style={{ color: colors.text.primary }}
            className="text-lg font-semibold"
            numberOfLines={1}>
            {title}
          </Text>
          {shouldShow && statusText && (
            <View className="mt-0.5 flex-row items-center">
              <View
                style={{
                  backgroundColor:
                    statusText === 'Online' ? colors.status.online : colors.status.offline,
                }}
                className="mr-1.5 h-2 w-2 rounded-full"
              />
              <Text style={{ color: colors.text.secondary }} className="text-xs">
                {statusText}
              </Text>
            </View>
          )}
        </View>

        {/* Leave Button */}
        {onLeavePress && (
          <TouchableOpacity
            onPress={onLeavePress}
            className="ml-3 h-10 w-10 items-center justify-center"
            activeOpacity={0.7}>
            <Ionicons name="exit" size={24} color={colors.status.offline} />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export const ChatHeader = React.memo(ChatHeaderComponent, (prev, next) => {
  return (
    prev.title === next.title &&
    prev.userId === next.userId &&
    prev.lastSeen === next.lastSeen &&
    prev.userAvatarUrl === next.userAvatarUrl &&
    prev.userName === next.userName &&
    prev.onLeavePress === next.onLeavePress &&
    prev.onBackPress === next.onBackPress
  );
});
ChatHeader.displayName = 'ChatHeader';
