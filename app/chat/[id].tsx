import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, TextInput, ActivityIndicator, Text, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSharedValue, useAnimatedStyle, interpolate, Extrapolate } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { ChatHeader, ChatInputFooter, MessageBubble, ScrollToBottom, ErrorBoundary, ErrorState, MessageStatus, TypingIndicator } from '@/components/ui';
import { useInfiniteMessages, useSendMessage, useProfile, useGetConversation } from '@/hooks';
import { useMessageStore, useUserStore } from '@/stores';
import { socketClient } from '@/lib/socket';
import { SPACING } from '@/lib';
import { pickImageFromLibrary, takePhotoWithCamera } from '@/lib/image-picker';
import { Message, MessageType } from '@/models';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = parseInt(id || '0', 10);
  const inputRef = useRef<TextInput>(null);

  // ============== Data ==============
  const { data: user } = useProfile();
  const { data: conversation } = useGetConversation(conversationId);
  const {
    data,
    isLoading: messagesLoading,
    error: messagesError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessages(conversationId, !!conversationId);
  
  const messages = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap((page: Message[]) => page);
  }, [data]);
  
  const sendMutation = useSendMessage(conversationId);

  // ============== Socket/Room ==============
  useEffect(() => {
    socketClient.joinConversation(conversationId);
    return () => {
      socketClient.leaveConversation(conversationId);
      // Cleanup typing timeout on unmount
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [conversationId]);

  // ============== Input State ==============
  const [messageText, setMessageText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isUserTyping } = useUserStore();
  const otherParticipant = conversation?.participants?.find((p) => p.id !== user?.id);

  const handleMessageTextChange = useCallback((text: string) => {
    setMessageText(text);
    
    // Send typing indicator
    if (!isTyping && text.length > 0) {
      setIsTyping(true);
      socketClient.startTyping(conversationId);
    }
    
    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Set timeout to stop typing after 2 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false);
      socketClient.stopTyping(conversationId);
    }, 2000);
  }, [conversationId, isTyping]);

  const handleSend = useCallback(() => {
    if (!messageText.trim()) return;
    sendMutation.mutate({
      conversationId,
      type: MessageType.TEXT,
      content: messageText,
      replyToId: replyToMessage?.id,
    });
    setMessageText('');
    setReplyToMessage(null);
  }, [messageText, replyToMessage, conversationId, sendMutation]);

  const handleReply = useCallback((msg: Message) => {
    setReplyToMessage(msg);
    inputRef.current?.focus();
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  // ============== Image Picker Handlers ==============
  const handlePickImage = useCallback(async () => {
    const imageUri = await pickImageFromLibrary();
    if (imageUri) {
      // TODO: Send image message
      console.log('Image picked:', imageUri);
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    const photoUri = await takePhotoWithCamera();
    if (photoUri) {
      // TODO: Send photo message
      console.log('Photo taken:', photoUri);
    }
  }, []);

  // ============== Optimistic Messages ==============
  const { optimisticMessages } = useMessageStore();
  const conversationOptimisticMessages = useMemo(
    () => Array.from(optimisticMessages.values()).filter((msg) => msg.conversationId === conversationId),
    [optimisticMessages, conversationId]
  );

  // ============== Combined Messages ==============
  const combinedMessages = useMemo(() => {
    const combined = [...(messages || []), ...conversationOptimisticMessages];
    // Sort by createdAt timestamp (newest first for FlatList inverted)
    return combined.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Reversed: newest first
    });
  }, [messages, conversationOptimisticMessages]);


  // ============== Shared Animated Values ==============
  const sharedRowTranslateX = useSharedValue(0);
  const sharedTimestampOpacity = useSharedValue(0);

  // ============== Refs ==============
  const flatListRef = useRef<FlatList<Message>>(null);
  const messageAreaRef = useRef<View>(null);
  
  // ============== Show scroll button when not at top (inverted) ==============
  const shouldShowButton = useSharedValue(0);
  const showScrollButtonStyle = useAnimatedStyle(() => ({
    opacity: shouldShowButton.value,
    pointerEvents: shouldShowButton.value > 0.5 ? 'auto' : 'none',
  }));

  // ============== Key Extractor ==============
  const keyExtractor = useCallback((item: Message) => {
    return `msg-${item.id}`;
  }, []);

  // ============== Scroll Handler ==============
  const handleScroll = useCallback((e: any) => {
    const contentOffsetY = e.nativeEvent.contentOffset.y;
    // With inverted list, check if we're at the top (near newest messages)
    const isNearTop = contentOffsetY <= 100;
    shouldShowButton.value = isNearTop ? 0 : 1;
  }, [shouldShowButton]);
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.id;
    // Check if this is the last own message (most recent own message - first in inverted list)
    const isLastOwnMessage = isOwn && !combinedMessages.slice(0, index).some(msg => msg.senderId === user?.id);
    
    // Safe array bounds checking
    const previousMessage = index + 1 < combinedMessages.length ? combinedMessages[index + 1] : undefined;
    const nextMessage = index > 0 ? combinedMessages[index - 1] : undefined;

    return (
      <ErrorBoundary componentName="MessageBubble">
        <View>
          <MessageBubble
            message={item}
            previousMessage={previousMessage}
            nextMessage={nextMessage}
            isOwn={isOwn}
            isLastOwnMessage={isLastOwnMessage}
            currentUserId={user?.id}
            onReply={handleReply}
            onShowMenu={() => {}}
            sharedRowTranslateX={sharedRowTranslateX}
            sharedTimestampOpacity={sharedTimestampOpacity}
          />
          {isLastOwnMessage && (
            <View className="mt-1 flex-row items-center justify-end gap-1 pr-1">
              <MessageStatus reads={item.reads} currentUserId={user?.id} />
            </View>
          )}
        </View>
      </ErrorBoundary>
    );
  }, [combinedMessages, user?.id, handleReply, sharedRowTranslateX, sharedTimestampOpacity]);

  // ============== Loading State ==============
  if (messagesLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // ============== Error State ==============
  if (messagesError && !messages.length) {
    return (
      <View className="flex-1 bg-white">
        <ChatHeader title="Chat" />
        <View className="flex-1 items-center justify-center">
          <ErrorState
            error={messagesError as Error}
            onRetry={() => {
              window.location.reload();
            }}
            message="Failed to load messages. Check your connection and try again."
          />
        </View>
        <ChatInputFooter
          messageText={messageText}
          onChangeText={handleMessageTextChange}
          onSend={handleSend}
          replyToMessage={replyToMessage}
          onCancelReply={cancelReply}
          sendingMessage={sendMutation.isPending}
          inputRef={inputRef}
          onPickImage={handlePickImage}
          onTakePhoto={handleTakePhoto}
          onPickAudio={() => {}}
        />
      </View>
    );
  }

  // ============== Render ==============
  return (
    <View className="flex-1 bg-white">
      <ChatHeader title="Chat" />

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0} style={{ flex: 1 }}>
        <View ref={messageAreaRef} style={{ flex: 1, position: 'relative' }}>
          <FlatList
            ref={flatListRef}
            data={combinedMessages}
            keyExtractor={keyExtractor}
            inverted
            onScroll={handleScroll}
            scrollEventThrottle={16}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) {
                fetchNextPage();
              }
            }}
            onEndReachedThreshold={0.5}
            ListFooterComponent={
              <>
                {isFetchingNextPage && (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color="#3B82F6" />
                  </View>
                )}
                {messagesError && messages.length > 0 && (
                  <View className="mx-4 my-2">
                    <ErrorState
                      error={messagesError as Error}
                      onRetry={() => {
                        fetchNextPage();
                      }}
                      compact
                      message="Failed to load more messages"
                    />
                  </View>
                )}
              </>
            }
            renderItem={renderItem}
            contentContainerStyle={{ paddingHorizontal: SPACING.MESSAGE_HORIZONTAL, paddingVertical: SPACING.MESSAGE_VERTICAL }}
            ListEmptyComponent={
              <View className="flex-1 items-center justify-center py-20">
                <Text className="text-base text-gray-400">No messages yet</Text>
                <Text className="mt-1 text-sm text-gray-400">Start the conversation</Text>
              </View>
            }
          />
          
          <Animated.View
            style={[
              { position: 'absolute', bottom: 20, left: 0, right: 0, alignItems: 'center', zIndex: 10 },
              showScrollButtonStyle,
            ]}
            pointerEvents="box-none">
            <ScrollToBottom visible={true} onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
          </Animated.View>
        </View>

        {/* Typing Indicator - Only takes space when visible */}
        <TypingIndicator
          visible={otherParticipant?.id ? isUserTyping(otherParticipant.id) : false}
          userName={otherParticipant?.name}
        />

        <ChatInputFooter
          messageText={messageText}
          onChangeText={handleMessageTextChange}
          onSend={handleSend}
          replyToMessage={replyToMessage}
          onCancelReply={cancelReply}
          sendingMessage={sendMutation.isPending}
          inputRef={inputRef}
          onPickImage={handlePickImage}
          onTakePhoto={handleTakePhoto}
          onPickAudio={() => {}}
        />
      </KeyboardAvoidingView>
    </View>
  );
}
