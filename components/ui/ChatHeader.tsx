import { View, Text, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

interface ChatHeaderProps {
  title: string;
  isOnline?: boolean;
  onBackPress?: () => void;
}

export function ChatHeader({ title, isOnline = false, onBackPress }: ChatHeaderProps) {
  const insets = useSafeAreaInsets();

  const handleBack = () => {
    if (onBackPress) {
      onBackPress();
    } else {
      router.back();
    }
  };

  return (
    <View className="border-b border-gray-200 bg-white" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-2 py-3">
        <TouchableOpacity
          onPress={handleBack}
          className="mr-2 h-10 w-10 items-center justify-center"
          activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={28} color="#3B82F6" />
        </TouchableOpacity>

        <View className="flex-1">
          <Text className="text-lg font-semibold text-gray-900" numberOfLines={1}>
            {title}
          </Text>
          {isOnline && (
            <View className="mt-0.5 flex-row items-center">
              <View className="mr-1.5 h-2 w-2 rounded-full bg-green-500" />
              <Text className="text-xs text-gray-500">Online</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );
}
