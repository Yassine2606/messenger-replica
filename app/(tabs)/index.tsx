import React, { useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteConversations, useProfile } from '@/hooks';
import { useTheme } from '@/contexts';
import { ErrorState, Header, SocketConnectionStatus } from '@/components/common';
import { ConversationItem } from '@/components/chat';
import type { Conversation } from '@/models';
import { useUserStore } from '@/stores';

export default function ChatsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user } = useProfile();
  const {
    data: conversationsData,
    isLoading,
    error,
    refetch,
    hasNextPage,
    fetchNextPage,
    isFetchingNextPage,
  } = useInfiniteConversations();
  
  // Flatten all pages of conversations and deduplicate by ID
  const conversations = React.useMemo(() => {
    if (!conversationsData?.pages) return [];
    const allConversations = conversationsData.pages.flatMap((page) => page.data);
    
    // Deduplicate: keep first occurrence of each conversation ID
    const seen = new Set<number>();
    return allConversations.filter((conv) => {
      if (seen.has(conv.id)) return false;
      seen.add(conv.id);
      return true;
    });
  }, [conversationsData?.pages]);

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Get all user presence data from store for real-time updates
  const userPresence = useUserStore((state) => state.userPresence);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filter out empty conversations (no messages sent yet)
  const filteredConversations = React.useMemo(
    () => conversations.filter((conv) => conv.lastMessage !== null && conv.lastMessage !== undefined),
    [conversations]
  );

  // Refetch conversations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [refetch])
  );

  const handleConversationPress = useCallback(
    (conversationId: number) => {
      router.push({
        pathname: '/chat/[id]',
        params: { id: conversationId },
      });
    },
    []
  );

  const renderItem = useCallback(
    ({ item }: { item: Conversation }) => {
      const otherParticipant = item.participants?.find((p) => p.id !== user?.id);
      const realtimeLastSeen = otherParticipant
        ? userPresence.get(otherParticipant.id)?.lastSeen || otherParticipant.lastSeen
        : undefined;

      return (
        <TouchableOpacity activeOpacity={0.7} onPress={() => handleConversationPress(item.id)}>
          <ConversationItem
            conversation={item}
            currentUserId={user?.id}
            otherUserLastSeen={realtimeLastSeen}
          />
        </TouchableOpacity>
      );
    },
    [user?.id, userPresence, handleConversationPress]
  );

  const keyExtractor = useCallback((item: Conversation) => `conv-${item.id}`, []);

  const ItemSeparator = () => (
    <View style={{ backgroundColor: colors.border.primary }} className="h-px" />
  );

  if (isLoading && filteredConversations.length === 0) {
    return (
      <View
        style={{ flex: 1, backgroundColor: colors.bg.primary }}
        className="items-center justify-center">
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error && filteredConversations.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
        }}>
        <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          <Header title="Chats" showBackButton={false} />
          <SocketConnectionStatus />
          <ErrorState
            error={error as Error}
            onRetry={() => refetch()}
            message="Failed to load conversations. Please check your connection."
          />
        </View>
      </View>
    );
  }

  if (filteredConversations.length === 0) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg.primary,
        }}>
        <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
          <Header title="Chats" showBackButton={false} />
          <SocketConnectionStatus />
          <View className="flex-1 items-center justify-center px-6">
            <View className="items-center">
              <View
                style={{ backgroundColor: colors.bg.secondary }}
                className="mb-6 h-20 w-20 items-center justify-center rounded-full">
                <Ionicons
                  name="chatbubble-ellipses-outline"
                  size={40}
                  color={colors.text.tertiary}
                />
              </View>
              <Text
                style={{ color: colors.text.primary }}
                className="text-xl font-semibold text-center">
                No conversations yet
              </Text>
              <Text
                style={{ color: colors.text.secondary }}
                className="mt-2 text-center text-base leading-5">
                Start chatting with others by tapping the button below.
              </Text>
            </View>
          </View>

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.push('/select-user')}
            style={{
              backgroundColor: colors.primary,
              marginBottom: insets.bottom,
            }}
            className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg">
            <Ionicons name="create-outline" size={28} color={colors.text.inverted} />
          </TouchableOpacity>
        </View>
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
      <Header title="Chats" showBackButton={false} />
      <SocketConnectionStatus />

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

      <FlatList
        data={filteredConversations}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
          />
        }
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={15}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: 80,
          offset: 80 * index,
          index,
        })}
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/select-user')}
        style={{
          backgroundColor: colors.primary,
          marginBottom: insets.bottom,
        }}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg">
        <Ionicons name="create-outline" size={28} color={colors.text.inverted} />
      </TouchableOpacity>
    </View>
  );
}
