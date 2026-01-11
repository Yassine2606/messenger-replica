import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

interface UserAvatarProps {
  avatarUrl?: string;
  userName?: string;
  size?: 'sm' | 'md' | 'lg';
}

export function UserAvatar({ avatarUrl, userName, size = 'md' }: UserAvatarProps) {
  const { colors } = useTheme();
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
        style={{
          width: config.container,
          height: config.container,
          backgroundColor: colors.avatarBg,
          borderRadius: config.container / 2,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Text style={{ color: colors.text.inverted }} className={`font-semibold ${config.textSize}`}>
          {userName.charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: config.container,
        height: config.container,
        backgroundColor: colors.bg.tertiary,
        borderRadius: config.container / 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Ionicons name="person" size={config.icon} color={colors.text.secondary} />
    </View>
  );
}
