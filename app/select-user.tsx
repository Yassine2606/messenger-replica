import { View, Text, FlatList, TouchableOpacity, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGetAllUsers, useCreateOrGetConversation } from '@/hooks';
import { useTheme } from '@/contexts';
import { Header, SocketConnectionStatus } from '@/components/common';
import { UserItem } from '@/components/user';
import type { User } from '@/models';

export default function SelectUserScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: usersResponse, isLoading } = useGetAllUsers();
  const users = usersResponse?.data || [];
  const createOrGetConversation = useCreateOrGetConversation();

  const handleUserPress = async (user: User) => {
    try {
      const conversation = await createOrGetConversation.mutateAsync(user.id);
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversation.id },
      });
    } catch (error: any) {
      const status = error?.response?.status;
      const errorMsg = error?.response?.data?.error || error?.message;
      console.error('[SelectUser] Failed:', status, errorMsg);
      if (status === 404) {
        console.error('[SelectUser] User not found. Make sure user exists in database.');
      }
    }
  };

  if (isLoading) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.bg.primary }}
        className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.bg.primary,
        paddingBottom: insets.bottom,
      }}>
      <Header title="New Conversation" showBackButton={true} />
      <SocketConnectionStatus />

      <FlatList
        data={users}
        keyExtractor={(item) => item.id.toString()}
        scrollIndicatorInsets={{ right: 1 }}
        renderItem={({ item }) => (
          <TouchableOpacity activeOpacity={0.7} onPress={() => handleUserPress(item)}>
            <UserItem user={item} />
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text style={{ color: colors.text.secondary }} className="text-base">
              No users available
            </Text>
          </View>
        }
      />
    </View>
  );
}
