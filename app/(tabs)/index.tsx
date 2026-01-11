import React, { useCallback, useEffect } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, RefreshControl, FlatList } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useGetConversations, useProfile, useUserPresence } from '@/hooks';
import { useTheme } from '@/contexts';
import { ErrorState, Header, SocketConnectionStatus } from '@/components/common';
import { ConversationItem } from '@/components/chat';
import type { Conversation } from '@/models';
import { useUserStore } from '@/stores';
import { socketClient } from '@/lib/socket';
import { conversationQueryKeys } from '@/lib/query-keys';

export default function ChatsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { data: user } = useProfile();
  const { data: conversations = [], isLoading, error, refetch } = useGetConversations();
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  const queryClient = useQueryClient();
  
  // Get all user presence data from store for real-time updates
  const userPresence = useUserStore((state) => state.userPresence);
  
  // Listen for unified message events to invalidate conversations list
  useEffect(() => {
    const unsubscribe = socketClient.onMessageUnified(() => {
      // Invalidate conversations list to trigger refetch on any message change
      queryClient.invalidateQueries({ queryKey: conversationQueryKeys.list() });
    });
    
    return () => {
      unsubscribe?.();
    };
  }, [queryClient]);

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

  const renderItem = ({ item }: { item: Conversation }) => {
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
  };

  const keyExtractor = (item: Conversation) => `conv-${item.id}`;

  const ItemSeparator = () => <View style={{ backgroundColor: colors.border.primary }} className="h-px" />;

  if (isLoading && filteredConversations.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }} className="items-center justify-center">
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
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
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
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
        }}>
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <Header title="Chats" showBackButton={false} />
        <SocketConnectionStatus />
        <View className="flex-1 items-center justify-center px-6">
          <Text style={{ color: colors.text.primary }} className="text-xl font-semibold">
            No conversations yet
          </Text>
          <Text style={{ color: colors.text.secondary }} className="mt-2 text-center text-base">
            Start chatting with others by tapping the button below.
          </Text>
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
