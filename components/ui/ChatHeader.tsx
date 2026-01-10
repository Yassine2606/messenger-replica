import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useUserPresence } from '@/hooks';
import { formatTimeAgo, shouldShowOnlineIndicator } from '@/lib/time-utils';
import { UserAvatar } from './UserAvatar';

interface ChatHeaderProps {
  title: string;
  userId?: number;
  lastSeen?: string;
  onBackPress?: () => void;
  userName?: string;
  userAvatarUrl?: string;
}

export function ChatHeader({ title, userId, lastSeen, onBackPress, userName, userAvatarUrl }: ChatHeaderProps) {
  const insets = useSafeAreaInsets();
  // Always call the hook, it handles the conditional logic internally
  const realtimeLastSeen = useUserPresence(userId, lastSeen);

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  const statusText = realtimeLastSeen ? formatTimeAgo(realtimeLastSeen) : null;
  const shouldShow = realtimeLastSeen ? shouldShowOnlineIndicator(realtimeLastSeen) : false;

  return (
    <View className="border-b border-gray-200 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 py-3">
        <TouchableOpacity
          onPress={handleBack}
          className="mr-3 h-10 w-10 items-center justify-center"
          activeOpacity={0.7}>
          <Ionicons name="arrow-back" size={28} color="#3B82F6" />
        </TouchableOpacity>

        {/* Avatar */}
        <View className="mr-3">
          <UserAvatar avatarUrl={userAvatarUrl} userName={userName} size="md" />
        </View>

        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
            {title}
          </Text>
          {shouldShow && statusText && (
            <View className="mt-0.5 flex-row items-center">
              <View className={`mr-1.5 h-2 w-2 rounded-full ${statusText === 'Online' ? 'bg-green-500' : 'bg-gray-400'}`} />
              <Text className="text-xs text-gray-500">{statusText}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
