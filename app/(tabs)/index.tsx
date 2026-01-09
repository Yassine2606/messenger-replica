import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGetConversations, useProfile } from '@/hooks';
import { ConversationItem, ErrorState } from '@/components/ui';
import type { Conversation } from '@/models';

export default function ChatsScreen() {
  const insets = useSafeAreaInsets();
  const { data: user } = useProfile();
  const { data: conversations = [], isLoading, error, refetch } = useGetConversations();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter out empty conversations (no messages sent yet)
  const filteredConversations = conversations.filter(
    (conv) => conv.lastMessage !== null && conv.lastMessage !== undefined
  );

  // Refetch conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleConversationPress = (conversationId: number) => {
    router.push({
      pathname: '/chat/[id]',
      params: { id: conversationId },
    });
  };

  const renderItem = ({ item }: { item: Conversation }) => (
    <TouchableOpacity activeOpacity={0.7} onPress={() => handleConversationPress(item.id)}>
      <ConversationItem conversation={item} currentUserId={user?.id} />
    </TouchableOpacity>
  );

  const keyExtractor = (item: Conversation) => `conv-${item.id}`;

  const ItemSeparator = () => <View className="h-px bg-gray-100" />;

  if (isLoading && filteredConversations.length === 0) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (error && filteredConversations.length === 0) {
    return (
      <View
        className="flex-1 bg-white"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="border-b border-gray-200 px-4 py-4">
          <Text className="text-2xl font-bold text-gray-900">Chats</Text>
        </View>
        <ErrorState
          error={error as Error}
          onRetry={() => refetch()}
          message="Failed to load conversations. Please check your connection."
        />
      </View>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <View
        className="flex-1 bg-white"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="border-b border-gray-200 px-4 py-4">
          <Text className="text-2xl font-bold text-gray-900">Chats</Text>
        </View>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-xl font-semibold text-gray-900">No conversations yet</Text>
          <Text className="mt-2 text-center text-base text-gray-600">
            Start chatting with others by tapping the button below.
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/select-user')}
          className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-500 shadow-lg"
          style={{ marginBottom: insets.bottom }}>
          <Ionicons name="create-outline" size={28} color="white" />
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View className="border-b border-gray-200 px-4 py-4">
        <Text className="text-2xl font-bold text-gray-900">Chats</Text>
      </View>

      {error && (
        <View className="mx-4 my-2">
          <ErrorState
            error={error as Error}
            onRetry={() => refetch()}
            compact
            message="Error loading conversations"
          />
        </View>
      )}

      <FlashList
        data={filteredConversations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3B82F6"
          />
        }
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/select-user')}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full bg-blue-500 shadow-lg"
        style={{ marginBottom: insets.bottom }}>
        <Ionicons name="create-outline" size={28} color="white" />
      </TouchableOpacity>
    </View>
  );
}
