import { Text, View } from 'react-native';
import { useTheme } from '@/contexts';
import type { User } from '@/models';
import { UserAvatar } from './UserAvatar';

interface UserItemProps {
  user: User;
}

export function UserItem({ user }: UserItemProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        borderBottomColor: colors.border.primary,
        backgroundColor: colors.bg.primary,
      }}
      className="flex-row items-stretch border-b px-4 py-4">
      {/* Avatar */}
      <View className="mr-4 justify-center">
        <UserAvatar avatarUrl={user.avatarUrl} userName={user.name} size="lg" />
      </View>

      {/* Content */}
      <View className="flex-1 justify-center">
        {/* Name */}
        <Text
          style={{ color: colors.text.primary }}
          className="text-base font-semibold"
          numberOfLines={1}>
          {user.name}
        </Text>

        {/* Status if available */}
        {user.status && (
          <Text style={{ color: colors.text.tertiary }} className="mt-1 text-xs" numberOfLines={1}>
            {user.status}
          </Text>
        )}
      </View>
    </View>
  );
}
