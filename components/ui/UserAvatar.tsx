import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';

interface UserAvatarProps {
  avatarUrl?: string;
  userName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ avatarUrl, userName, size = 'md' }: UserAvatarProps) {
  const sizeConfig = {
    sm: { container: 32, icon: 16, textSize: 'text-xs' },
    md: { container: 40, icon: 30, textSize: 'text-sm' },
    lg: { container: 64, icon: 45, textSize: 'text-2xl' },
  };

  const config = sizeConfig[size];

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={{
          width: config.container,
          height: config.container,
          borderRadius: config.container / 2,
        }}
      />
    );
  }

  if (userName) {
    return (
      <View
        className="items-center justify-center rounded-full bg-blue-500"
        style={{
          width: config.container,
          height: config.container,
        }}>
        <Text className={`font-semibold text-white ${config.textSize}`}>
          {userName.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View
      className="items-center justify-center rounded-full bg-gray-300"
      style={{
        width: config.container,
        height: config.container,
      }}>
      <Ionicons name="person" size={config.icon} color="white" />
    </View>
  );
}
