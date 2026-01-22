import React, { useCallback } from 'react';
import {
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { messageService, conversationService } from '@/services';
import { messageQueryKeys, conversationQueryKeys } from '@/lib/query-keys';
import { Ionicons } from '@expo/vector-icons';
import { useInfiniteConversations, useProfile } from '@/hooks';
import { useTheme } from '@/contexts';
import { ErrorState, Header, SocketConnectionStatus, EmptyState } from '@/components/common';
import { ConversationItem } from '@/components/chat';
import type { Conversation } from '@/models';
import { useUserStore } from '@/stores';
import { ScreenLayout } from '@/components/layouts/ScreenLayout';

export default function ChatsScreen() {
  const { colors } = useTheme();
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
  // Prefetch helpers to warm up chat screen data for smoother navigation
  const queryClient = useQueryClient();
  const prefetchConversation = useCallback(async (conversation: Conversation) => {
    const id = conversation.id;

    // Seed the conversation detail cache so header can render immediately
    queryClient.setQueryData(conversationQueryKeys.detail(id), conversation);

    // Prefetch conversation detail from server (refresh in background)
    queryClient.prefetchQuery({
      queryKey: conversationQueryKeys.detail(id),
      queryFn: () => conversationService.getConversation(id),
    }).catch(() => {});

    // Prefetch initial page of messages for the conversation
    queryClient.prefetchInfiniteQuery({
      queryKey: messageQueryKeys.byConversation(id),
      queryFn: async ({ pageParam }: { pageParam?: string | number } = {}) => {
        const res = await messageService.getMessages(id, { limit: 20, before: pageParam ? Number(pageParam) : undefined });
        return { ...res, data: res.data.map((m) => ({ ...m, createdAtMs: Date.parse(m.createdAt) })) };
      },
      initialPageParam: undefined,
    }).catch(() => {});

    // Prefetch avatar image (if available)
    const otherParticipant = conversation.participants?.find((p) => p.id !== (conversationsData?.pages?.[0]?.data?.[0]?.participants?.[0]?.id ?? 0));
    const avatarUrl = conversation.participants?.find((p) => p.id !== undefined)?.avatarUrl || undefined;
    if (avatarUrl) {
      Image.prefetch(avatarUrl).catch(() => {});
    }
  }, [queryClient, conversationsData]);  
  const ITEM_HEIGHT = 80;

  // Combine pagination pages, dedupe, and filter out conversations without messages
  const conversationsList = React.useMemo(() => {
    if (!conversationsData?.pages) return [];
    const allConversations = conversationsData.pages.flatMap((page) => page.data);

    const seen = new Set<number>();
    const deduped: Conversation[] = [];

    for (const conv of allConversations) {
      if (!conv.lastMessage) continue; // Skip empty conversations
      if (seen.has(conv.id)) continue;
      seen.add(conv.id);
      deduped.push(conv);
    }

    return deduped;
  }, [conversationsData?.pages]);

  const [isRefreshing, setIsRefreshing] = React.useState(false);

  // Get all user presence data from store for real-time updates
  const userPresence = useUserStore((state) => state.userPresence);

  const handleRefresh = React.useCallback(async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setIsRefreshing(false);
    }
  }, [refetch]);

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
        <TouchableOpacity
          activeOpacity={0.7}
          onPressIn={() => prefetchConversation(item)}
          onPress={() => handleConversationPress(item.id)}>
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

  const ItemSeparator = React.useCallback(() => (
    <View style={{ backgroundColor: colors.border.primary }} className="h-px" />
  ), [colors.border.primary]);

  // End reached handler for cursor pagination
  const handleEndReached = React.useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const ListFooterComponent = React.useMemo(() => {
    if (!isFetchingNextPage) return null;
    return (
      <View className="py-4">
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }, [isFetchingNextPage, colors.primary]);

  if (isLoading && conversationsList.length === 0) {
    return (
      <ScreenLayout>
        <Header title="Chats" showBackButton={false} />
        <SocketConnectionStatus />
        <View style={{ flex: 1 }} className="items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={() => router.push('/select-user')}
          style={{
            backgroundColor: colors.primary,
          }}
          className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg">
          <Ionicons name="create-outline" size={28} color={colors.text.inverted} />
        </TouchableOpacity>
      </ScreenLayout>
    );
  }

  return (
    <ScreenLayout edges={['top', 'right', 'left']}>
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
        data={conversationsList}
        keyExtractor={keyExtractor}
        renderItem={renderItem}
        ItemSeparatorComponent={ItemSeparator}
        refreshing={isRefreshing}
        onRefresh={handleRefresh}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.6}
        ListFooterComponent={ListFooterComponent}
        ListEmptyComponent={() => (
          <EmptyState
            title="No conversations yet"
            description="Start chatting with others by tapping the button below."
          />
        )}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={50}
        initialNumToRender={12}
        windowSize={5}
        removeClippedSubviews={true}
        getItemLayout={(data, index) => ({
          length: ITEM_HEIGHT,
          offset: ITEM_HEIGHT * index,
          index,
        })}
        contentContainerStyle={{ paddingBottom: 80 }}
      />

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push('/select-user')}
        style={{
          backgroundColor: colors.primary,
        }}
        className="absolute bottom-6 right-6 h-14 w-14 items-center justify-center rounded-full shadow-lg">
        <Ionicons name="create-outline" size={28} color={colors.text.inverted} />
      </TouchableOpacity>
    </ScreenLayout>
    );
}
