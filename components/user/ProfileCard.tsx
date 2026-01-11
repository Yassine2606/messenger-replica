import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/contexts';

interface ProfileCardProps {
  icon: string;
  label: string;
  value: string;
}

export function ProfileCard({ icon, label, value }: ProfileCardProps) {
  const { colors } = useTheme();

  return (
    <View
      style={{
        borderColor: colors.border.primary,
        backgroundColor: colors.bg.primary,
      }}
      className="flex-row items-center rounded-xl border px-4 py-4 shadow-sm">
      <View
        style={{ backgroundColor: colors.primary }}
        className="mr-3.5 h-10 w-10 items-center justify-center rounded-lg">
        <Ionicons name={icon as any} size={20} color={colors.text.inverted} />
      </View>
      <View className="flex-1">
        <Text style={{ color: colors.text.secondary }} className="text-xs font-medium uppercase tracking-wider">
          {label}
        </Text>
        <Text style={{ color: colors.text.primary }} className="mt-1 text-base font-semibold" numberOfLines={1}>
          {value || 'Not set'}
        </Text>
      </View>
    </View>
  );
}
