import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAllUsers } from '@/hooks/useUser';
import { useCreateOrGetConversation } from '@/hooks/useConversation';
import { ChatHeader } from '@/components/ui';
import type { User } from '@/models';

export default function SelectUserScreen() {
  const insets = useSafeAreaInsets();
  const { data: users = [], isLoading } = useAllUsers();
  const createOrGetConversation = useCreateOrGetConversation();

  const handleUserPress = async (user: User) => {
    try {
      const conversation = await createOrGetConversation.mutateAsync(user.id);
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.id },
      });
    } catch (error) {
      console.error('Failed to create/get conversation:', error);
    }
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingBottom: insets.bottom }}>
      <ChatHeader title="New Conversation" />

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => handleUserPress(item)}
            className="flex-row items-center border-b border-gray-100 px-4 py-4">
            <View className="mr-3 h-12 w-12 items-center justify-center rounded-full bg-blue-500">
              <Text className="text-lg font-semibold text-white">
                {item.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-gray-900">{item.name}</Text>
              <Text className="mt-1 text-sm text-gray-500">{item.email}</Text>
            </View>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-base text-gray-500">No users available</Text>
          </View>
        }
      />
    </View>
  );
}
