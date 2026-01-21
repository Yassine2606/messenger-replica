import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, TextInput, ActivityIndicator, Text, Alert, Platform, FlatList } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  useAnimatedReaction,
  runOnJS,
} from 'react-native-reanimated';

import * as Haptics from 'expo-haptics';
import { ErrorBoundary, ErrorState, SocketConnectionStatus } from '@/components/common';
import {
  ChatHeader,
  ChatInputFooter,
  MessageBubble,
  ScrollToBottom,
  MessageStatus,
  TypingIndicator,
  TimeSeparator,
  MessageContextMenuModal,
} from '@/components/chat';
import { ImageViewer, AudioRecordingControls, VoiceMessagePlayer } from '@/components/media';
import {
  useInfiniteMessages,
  useProfile,
  useGetConversation,
  useDeleteMessage,
  useAudioHandlers,
  useImageHandlers,
  useTypingIndicator,
  useAudioRecording,
  useSendMessage,
  useMarkMessagesAsRead,
} from '@/hooks';
import { useMessageStore, useUserStore } from '@/stores';
import { useTheme } from '@/contexts';
import { socketClient } from '@/lib/socket';
import { SPACING } from '@/lib';
import { Message, MessageType, PaginatedResponse } from '@/models';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = parseInt(id || '0', 10);
  const inputRef = useRef<TextInput>(null);

  // ============== Context Menu ==============
  const [activeContextMessage, setActiveContextMessage] = useState<Message | null>(null);
  const deleteMessageMutation = useDeleteMessage(conversationId);
  const { data: user } = useProfile();

  const handleMessageContextMenu = useCallback(
    (message: Message) => {
      const isOwnMessage = message.senderId === user?.id;

      if (isOwnMessage) {
        // Own message - show delete modal
        setActiveContextMessage(message);
      }
    },
    [user?.id]
  );

  const closeContextMenu = useCallback(() => {
    setActiveContextMessage(null);
  }, []);

  const handleDeleteMessage = useCallback(async () => {
    if (!activeContextMessage) return;

    try {
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      // Silently fail on unsupported platforms
    }

    deleteMessageMutation.mutate(activeContextMessage.id, {
      onSuccess: () => {
        closeContextMenu();
      },
      onError: (error) => {
        console.error('Failed to delete message:', error);
        Alert.alert('Error', 'Failed to delete message. Please try again.');
      },
    });
  }, [activeContextMessage, deleteMessageMutation, closeContextMenu]);

  // ============== Data ==============
  const { data: conversation } = useGetConversation(conversationId);
  const infiniteMessagesResult = useInfiniteMessages(conversationId, !!conversationId);
  const {
    data,
    isLoading: messagesLoading,
    error: messagesError,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
  } = infiniteMessagesResult;

  const messages = useMemo(() => {
    if (!data?.pages) return [];
    // Pages array structure with newest-first DESC order from backend:
    // - Each page: messages in DESC order (newest first)
    // - Pages array: [page0(newest msgs), page1(older msgs), ...]
    // Flatten to get all messages, maintaining DESC order (newest first)
    return data.pages.flatMap((page: PaginatedResponse<Message>) => page.data);
  }, [data]);

  // ============== Socket/Room ==============
  useEffect(() => {
    socketClient.joinConversation(conversationId);
    return () => {
      socketClient.leaveConversation(conversationId);
    };
  }, [conversationId]);

  // ============== Mark Messages as Read ==============
  useMarkMessagesAsRead(conversationId, messages, user?.id);

  // ============== Input State ==============
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerUri, setImageViewerUri] = useState('');
  const [imageViewerDimensions, setImageViewerDimensions] = useState<
    { width: number; height: number } | undefined
  >();
  const [imageSourceLayout, setImageSourceLayout] = useState<
    | {
        x: number;
        y: number;
        width: number;
        height: number;
      }
    | undefined
  >();

  const { isUserTyping } = useUserStore();
  const otherParticipant = conversation?.participants?.find((p) => p.id !== user?.id);

  // ============== Typing Indicator Hook ==============
  const sendMutation = useSendMessage(conversationId);

  // ============== Image Handlers Hook ==============
  const { handlePickImage, handleTakePhoto } = useImageHandlers({
    conversationId,
    replyToMessage,
    onReplyCleared: () => setReplyToMessage(null),
  });

  // ============== Image Picker Handler ==============
  const openImagePicker = useCallback(() => {
    handlePickImage();
  }, [handlePickImage]);

  // ============== Audio Handlers Hook ==============
  const audioRecording = useAudioRecording();
  const { isRecording, duration: recordingDuration } = audioRecording;
  const { handleStartRecording, handleStopRecording, handleCancelRecording } = useAudioHandlers({
    conversationId,
    replyToMessage,
    onReplyCleared: () => setReplyToMessage(null),
    startRecording: audioRecording.startRecording,
    stopRecording: audioRecording.stopRecording,
    cancelRecording: audioRecording.cancelRecording,
  });

  // ============== Send Message Hook ==============

  const handleSend = useCallback((text: string) => {
    const trimmedText = text.trim();
    if (!trimmedText) return;

    // Send message immediately without clearing state first
    sendMutation.mutate(
      {
        conversationId,
        type: MessageType.TEXT,
        content: trimmedText,
        replyToId: replyToMessage?.id,
      },
      {
        onSuccess: () => {
          // Clear state AFTER successful send (optimistic update already in place)
          setReplyToMessage(null);
          // Scroll to bottom after message sent
          setTimeout(() => {
            flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
          }, 50);
        },
        onError: (error) => {
          console.error('Failed to send message:', error);
          // Text stays for retry
        },
      }
    );
  }, [replyToMessage, sendMutation]);

  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, []);

  // Focus input when reply is activated
  useEffect(() => {
    if (replyToMessage) {
      inputRef.current?.focus();
    }
  }, [replyToMessage]);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleImagePress = useCallback(
    (imageUri: string, layout?: { x: number; y: number; width: number; height: number }) => {
      const API_BASE_URL =
        process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
      setImageViewerUri(`${API_BASE_URL}${imageUri}`);
      setImageSourceLayout(layout);
      // Pass the rendered image dimensions (120x200 from MessageBubble) to skip Image.getSize() call
      setImageViewerDimensions({ width: 120, height: 200 });
      setImageViewerVisible(true);
    },
    []
  );

  // ============== Optimistic Messages ==============
  const { optimisticMessages } = useMessageStore();
  const conversationOptimisticMessages = useMemo(
    () =>
      Array.from(optimisticMessages.values()).filter(
        (msg) => msg.conversationId === conversationId
      ),
    [optimisticMessages, conversationId]
  );

  // ============== Combined Messages ==============
  const combinedMessages = useMemo(() => {
    // Combine cache messages (in DESC order from backend) and optimistic messages
    const combined = [...(messages || []), ...conversationOptimisticMessages];
    
    // Deduplicate by ID (in case message appears in both cache and store)
    const seen = new Set<number>();
    const deduped = combined.filter((msg) => {
      if (seen.has(msg.id)) return false;
      seen.add(msg.id);
      return true;
    });
    
    // Sort by createdAt timestamp DESC (newest first)
    // This ensures optimistic messages (newest) stay on top
    return deduped.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return timeB - timeA; // Descending: newest first
    });
  }, [messages, conversationOptimisticMessages]);

  const handleScrollToReply = useCallback(
    async (message: Message) => {
      if (!message.replyTo || !message.replyTo.id) return;
      const index = combinedMessages.findIndex((msg) => msg.id === message.replyTo!.id);
      if (index !== -1) {
        // FlashList uses scrollToIndex API
        flatListRef.current?.scrollToIndex({ index, animated: false });
      }
    },
    [combinedMessages]
  );

  // ============== Shared Animated Values ==============
  const sharedRowTranslateX = useSharedValue(0);
  const sharedTimestampOpacity = useSharedValue(0);

  // ============== Refs ==============
  const flatListRef = useRef<FlatList<Message>>(null);
  const messageAreaRef = useRef<View>(null);

  // ============== Show scroll button when not at top (inverted) ==============
  const shouldShowButton = useSharedValue(0);
  const [buttonVisible, setButtonVisible] = useState(false);
  const isTypingIndicatorVisible = otherParticipant?.id ? isUserTyping(conversationId, otherParticipant.id) : false;

  useAnimatedReaction(
    () => shouldShowButton.value,
    (value) => {
      runOnJS(setButtonVisible)(value > 0.5 && !isTypingIndicatorVisible);
    }
  );

  // Hide button immediately when typing indicator appears
  useEffect(() => {
    if (isTypingIndicatorVisible) {
      setButtonVisible(false);
    }
  }, [isTypingIndicatorVisible]);

  const showScrollButtonStyle = useAnimatedStyle(() => ({
    pointerEvents: shouldShowButton.value > 0.5 ? 'auto' : 'none',
  }));

  // ============== Key Extractor ==============
  const keyExtractor = useCallback((item: Message) => {
    return `msg-${item.id}`;
  }, []);

  // ============== Scroll Handler ==============
  const handleScroll = useCallback(
    (e: any) => {
      const contentOffsetY = e.nativeEvent.contentOffset.y;
      // With inverted list, check if we're at the bottom (near newest messages)
      const isAtBottom = contentOffsetY <= 100;
      shouldShowButton.value = isAtBottom ? 0 : 1;
    },
    [shouldShowButton]
  );
  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => {
      const isOwn = item.senderId === user?.id;
      // Check if this is the last own message (most recent own message)
      // With inverted list: check if no newer own message exists before this one
      const isLastOwnMessage =
        isOwn && !combinedMessages.slice(0, index).some((msg) => msg.senderId === user?.id);

      // Safe array bounds checking
      const previousMessage =
        index + 1 < combinedMessages.length ? combinedMessages[index + 1] : undefined;
      const nextMessage = index > 0 ? combinedMessages[index - 1] : undefined;

      // Check if we need to show time separator (day boundary)
      // Only show separator if the previous message is from a different day
      const showTimeSeparator = (() => {
        if (!previousMessage) return true; // Always show for first message

        const currentDate = new Date(item.createdAt);
        const previousDate = new Date(previousMessage.createdAt);

        // Compare dates (ignoring time)
        return currentDate.toDateString() !== previousDate.toDateString();
      })();

      return (
        <ErrorBoundary componentName="MessageBubble">
          <View>
            {showTimeSeparator && <TimeSeparator date={item.createdAt} />}
            <MessageBubble
              message={item}
              previousMessage={previousMessage}
              nextMessage={nextMessage}
              showTimeSeparator={showTimeSeparator}
              isOwn={isOwn}
              onReply={handleReply}
              onShowMenu={() => {}}
              onContextMenu={handleMessageContextMenu}
              onImagePress={item.type === MessageType.IMAGE ? handleImagePress : undefined}
              onScrollToReply={handleScrollToReply}
              sharedRowTranslateX={sharedRowTranslateX}
              sharedTimestampOpacity={sharedTimestampOpacity}
            />
            {/* Audio player - rendered separately with width constraint */}
            {item.type === MessageType.AUDIO && item.mediaUrl && (
              <View className={`mt-1 flex-row ${isOwn ? 'justify-end' : 'justify-start'}`}>
                <VoiceMessagePlayer
                  audioUrl={
                    item.mediaUrl.startsWith('http')
                      ? item.mediaUrl
                      : `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}${item.mediaUrl}`.replace(
                          '/api/uploads',
                          '/uploads'
                        )
                  }
                  waveform={item.waveform || []}
                  duration={item.mediaDuration || 0}
                  isOwn={isOwn}
                  message={item}
                  previousMessage={previousMessage}
                  nextMessage={nextMessage}
                  onContextMenu={handleMessageContextMenu}
                />
              </View>
            )}
            {isLastOwnMessage && (
              <View className="mt-1 flex-row items-center justify-end gap-1 pr-1">
                <MessageStatus reads={item.reads} currentUserId={user?.id} />
              </View>
            )}
          </View>
        </ErrorBoundary>
      );
    },
    [
      combinedMessages,
      user?.id,
      handleReply,
      handleMessageContextMenu,
      handleImagePress,
      sharedRowTranslateX,
      sharedTimestampOpacity,
    ]
  );

  // ============== Loading State ==============
  if (messagesLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <ChatHeader
          title={`${otherParticipant?.name || 'Chat'}`}
          userId={otherParticipant?.id}
          lastSeen={otherParticipant?.lastSeen}
          userName={otherParticipant?.name}
          userAvatarUrl={otherParticipant?.avatarUrl}
        />
        <SocketConnectionStatus />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        <ChatInputFooter
          onSend={handleSend}
          replyTo={replyToMessage}
          onCancelReply={cancelReply}
          sendingMessage={sendMutation.isPending}
          onPickImage={handlePickImage}
          onTakePhoto={handleTakePhoto}
          onPickAudio={handleStartRecording}
        />
      </View>
    );
  }

  // ============== Error State ==============
  if (messagesError && !messages.length) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg.primary }}>
        <ChatHeader
          title={`${otherParticipant?.name || 'Chat'}`}
          userId={otherParticipant?.id}
          lastSeen={otherParticipant?.lastSeen}
          userName={otherParticipant?.name}
          userAvatarUrl={otherParticipant?.avatarUrl}
        />
        <SocketConnectionStatus />
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
          onSend={handleSend}
          replyTo={replyToMessage}
          onCancelReply={cancelReply}
          sendingMessage={sendMutation.isPending}
          onPickImage={handlePickImage}
          onTakePhoto={handleTakePhoto}
          onPickAudio={handleStartRecording}
        />
      </View>
    );
  }

  // ============== Render ==============
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.bg.primary }}>
      <View style={{ flex: 1 }}>
        <ImageViewer
          visible={imageViewerVisible}
          imageUri={imageViewerUri}
          onClose={() => setImageViewerVisible(false)}
          sourceLayout={imageSourceLayout}
          imageDimensions={imageViewerDimensions}
        />

        <ChatHeader
          title={`${otherParticipant?.name || 'Chat'}`}
          userId={otherParticipant?.id}
          lastSeen={otherParticipant?.lastSeen}
          userName={otherParticipant?.name}
          userAvatarUrl={otherParticipant?.avatarUrl}
        />
        <SocketConnectionStatus />

        <View style={{ flex: 1, position: 'relative', backgroundColor: colors.bg.primary }}>
          <View ref={messageAreaRef} style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={combinedMessages}
              keyExtractor={keyExtractor}
              extraData={combinedMessages}
              inverted
              removeClippedSubviews={true}
              initialNumToRender={12}
              windowSize={5}
              onScroll={handleScroll}
              scrollEventThrottle={16}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
                autoscrollToTopThreshold: 10,
              }}
              onEndReached={() => {
                if (hasPreviousPage && !isFetchingPreviousPage) {
                  fetchPreviousPage();
                }
              }}
              onEndReachedThreshold={0.5}
              scrollIndicatorInsets={{ right: 1 }}
              ListFooterComponent={
                <>
                  {isFetchingPreviousPage && (
                    <View className="items-center py-4">
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                  {messagesError && messages.length > 0 && (
                    <View className="mx-4 my-2">
                      <ErrorState
                        error={messagesError as Error}
                        onRetry={() => {
                          fetchPreviousPage();
                        }}
                        compact
                        message="Failed to load more messages"
                      />
                    </View>
                  )}
                </>
              }
              renderItem={renderItem}
              contentContainerStyle={{
                paddingHorizontal: SPACING.MESSAGE_HORIZONTAL,
                paddingVertical: SPACING.MESSAGE_VERTICAL,
              }}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-20">
                  <Ionicons
                    name="chatbubble-ellipses-outline"
                    size={48}
                    color={colors.text.tertiary}
                  />
                  <Text style={{ color: colors.text.secondary }} className="text-base">
                    No messages yet
                  </Text>
                  <Text style={{ color: colors.text.secondary }} className="mt-1 text-sm">
                    Start the conversation
                  </Text>
                </View>
              }
            />

            {/* Message Context Menu Modal */}
            <MessageContextMenuModal
              visible={activeContextMessage !== null}
              message={activeContextMessage}
              currentUserId={user?.id}
              onClose={closeContextMenu}
              onDelete={handleDeleteMessage}
              isDeleting={deleteMessageMutation.isPending}
            />
          </View>

          {/* ScrollToBottom - positioned outside FlatList hierarchy */}
          <Animated.View
            style={[
              { position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center' },
              showScrollButtonStyle,
            ]}
            pointerEvents="box-none">
            <ScrollToBottom
              visible={buttonVisible && !isTypingIndicatorVisible}
              onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false })}
            />
          </Animated.View>
        </View>

        {/* Typing Indicator - Only takes space when visible */}
        <TypingIndicator
          visible={otherParticipant?.id ? isUserTyping(conversationId, otherParticipant.id) : false}
          userName={otherParticipant?.name}
        />

        {/* Recording Controls or Chat Input - one or the other */}
        {isRecording ? (
          <AudioRecordingControls
            isRecording={isRecording}
            duration={recordingDuration}
            waveform={[]}
            onStop={handleStopRecording}
            onCancel={handleCancelRecording}
          />
        ) : (
          <ChatInputFooter
            onSend={handleSend}
            replyTo={replyToMessage}
            onCancelReply={cancelReply}
            sendingMessage={sendMutation.isPending}
            onPickImage={openImagePicker}
            onTakePhoto={handleTakePhoto}
            onPickAudio={handleStartRecording}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
