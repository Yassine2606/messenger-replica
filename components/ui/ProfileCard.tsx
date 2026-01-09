import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface ProfileCardProps {
  icon: string;
  label: string;
  value: string;
}

export function ProfileCard({ icon, label, value }: ProfileCardProps) {
  return (
    <View className="flex-row items-center rounded-xl border border-gray-200 bg-white px-4 py-4 shadow-sm">
      <View className="mr-3.5 h-10 w-10 items-center justify-center rounded-lg bg-blue-500">
        <Ionicons name={icon as any} size={20} color="#FFFFFF" />
      </View>
      <View className="flex-1">
        <Text className="text-xs font-medium uppercase tracking-wider text-gray-600">{label}</Text>
        <Text className="mt-1 text-base font-semibold text-gray-900" numberOfLines={1}>
          {value || 'Not set'}
        </Text>
      </View>
    </View>
  );
}
