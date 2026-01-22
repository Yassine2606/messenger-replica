import React, { useCallback, useMemo, useEffect, useRef } from 'react';
import { View, ActivityIndicator, Alert, FlatList } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Animated, { useSharedValue } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ErrorState, SocketConnectionStatus, EmptyState } from '@/components/common';
import {
  ChatHeader,
  ChatInputFooter,
  ScrollToBottom,
  TypingIndicator,
  MessageContextMenuModal,
  LeaveConversationModal,
  MessageListItem,
} from '@/components/chat';
import { ImageViewer, AudioRecordingControls } from '@/components/media';
import {
  useInfiniteMessages,
  useProfile,
  useGetConversation,
  useDeleteMessage,
  useAudioHandlers,
  useImageHandlers,
  useAudioRecording,
  useMarkMessagesAsRead,
  useLeaveConversation,
  useChatModals,
  useChatMessageSending,
  useChatScrollButton,
  useChatMessages,
} from '@/hooks';
import { useUserStore } from '@/stores';
import { useTheme } from '@/contexts';
import { ChatScreenLayout } from '@/components/layouts';
import { socketClient } from '@/lib/socket';
import { SPACING } from '@/lib';
import { Message } from '@/models';

export default function ChatScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = parseInt(id || '0', 10);

  // ============== Modals ==============
  const {
    leaveModalVisible,
    setLeaveModalVisible,
    isLeaving,
    setIsLeaving,
    activeContextMessage,
    setActiveContextMessage,
    closeContextMenu,
    imageViewerVisible,
    imageViewerUri,
    imageViewerDimensions,
    imageSourceLayout,
    handleImagePress,
    closeImageViewer,
  } = useChatModals();

  // Stable handler to open the leave conversation modal (prevent inline functions)
  const handleOpenLeaveModal = React.useCallback(() => setLeaveModalVisible(true), [setLeaveModalVisible]);

  // ============== Message Sending ==============
  const {
    replyToMessage,
    inputRef,
    handleSend,
    handleReply,
    cancelReply,
    clearReply,
    sendMutation,
  } = useChatMessageSending(conversationId);
  
    // ============== Data Fetching ==============
  const { data: conversation, error: conversationError } = useGetConversation(
    conversationId,
    !isLeaving
  );
  const infiniteMessagesResult = useInfiniteMessages(conversationId, !!conversationId);
  const {
    data,
    isLoading: messagesLoading,
    error: messagesError,
    fetchPreviousPage,
    hasPreviousPage,
    isFetchingPreviousPage,
  } = infiniteMessagesResult;
  // ============== User Data ==============
  const { data: user } = useProfile();
  const otherParticipant = useMemo(
    () => conversation?.participants?.find((p) => p.id !== user?.id),
    [conversation?.participants, user?.id]
  );

  // ============== Scroll & Button ==============
  const { isUserTyping } = useUserStore();
  const isTypingIndicatorVisible = useMemo(
    () => conversationId > 0 && otherParticipant?.id ? isUserTyping(conversationId, otherParticipant.id) : false,
    [conversationId, isUserTyping, otherParticipant?.id]
  );

  const {
    flatListRef,
    buttonVisible,
    handleScroll,
    showScrollButtonStyle,
    scrollToBottom,
    shouldShowButton,
  } = useChatScrollButton(isTypingIndicatorVisible);

  // Update scroll button visibility when typing indicator appears
  useEffect(() => {
    if (isTypingIndicatorVisible) {
      shouldShowButton.value = 0;
    }
  }, [isTypingIndicatorVisible, shouldShowButton]);


  // ============== Messages Composition ==============
  const { combinedMessages, keyExtractor } = useChatMessages(conversationId, data);

  // ============== Socket & Room ==============
  useFocusEffect(
    useCallback(() => {
      if (!conversationId || isLeaving) return;
      socketClient.joinConversation(conversationId);
      return () => {
        socketClient.leaveConversation(conversationId);
      };
    }, [conversationId, isLeaving])
  );

  // ============== Mark Messages as Read ==============
  useMarkMessagesAsRead(conversationId, combinedMessages, user?.id);

  // ============== Media Handlers ==============
  const { handlePickImage, handleTakePhoto } = useImageHandlers({
    conversationId,
    replyToMessage,
    onReplyCleared: clearReply,
  });

  const audioRecording = useAudioRecording();
  const { isRecording, duration: recordingDuration } = audioRecording;
  const { handleStartRecording, handleStopRecording, handleCancelRecording } = useAudioHandlers({
    conversationId,
    replyToMessage,
    onReplyCleared: clearReply,
    startRecording: audioRecording.startRecording,
    stopRecording: audioRecording.stopRecording,
    cancelRecording: audioRecording.cancelRecording,
  });

  // ============== Delete Message Handler ==============
  const deleteMessageMutation = useDeleteMessage(conversationId);
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

  // ============== Context Menu Handler ==============
  const handleMessageContextMenu = useCallback(
    (message: Message) => {
      const isOwnMessage = message.senderId === user?.id;
      if (isOwnMessage) {
        setActiveContextMessage(message);
      }
    },
    [user?.id, setActiveContextMessage]
  );

  // ============== Leave Conversation Handler ==============
  const leaveConversationMutation = useLeaveConversation();
  const handleLeaveConversation = useCallback(() => {
    setIsLeaving(true);

    leaveConversationMutation.mutate(conversationId, {
      onSuccess: () => {
        setLeaveModalVisible(false);
        setIsLeaving(false);
        router.back();
      },
      onError: (error) => {
        setIsLeaving(false);
        console.error('Failed to leave conversation:', error);
        Alert.alert('Error', 'Failed to leave conversation. Please try again.');
      },
    });
  }, [conversationId, leaveConversationMutation, setIsLeaving, setLeaveModalVisible, router])

  // ============== Scroll to Reply Handler ==============
  const handleScrollToReply = useCallback((message: Message) => {
    if (!message.replyTo || !message.replyTo.id) return;
    const index = combinedMessages.findIndex((msg) => msg.id === message.replyTo!.id);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: false });
    }
  }, [combinedMessages]);

  // ============== Render Item ==============
  const sharedRowTranslateX = useSharedValue(0);
  const sharedTimestampOpacity = useSharedValue(0);

  const renderItem = useCallback(
    ({ item, index }: { item: Message; index: number }) => (
      <MessageListItem
        item={item}
        index={index}
        previousMessage={index + 1 < combinedMessages.length ? combinedMessages[index + 1] : undefined}
        nextMessage={index > 0 ? combinedMessages[index - 1] : undefined}
        combinedMessages={combinedMessages}
        userId={user?.id}
        onReply={handleReply}
        onContextMenu={handleMessageContextMenu}
        onImagePress={handleImagePress}
        onScrollToReply={handleScrollToReply}
        sharedRowTranslateX={sharedRowTranslateX}
        sharedTimestampOpacity={sharedTimestampOpacity}
      />
    ),
    [
      combinedMessages,
      user?.id,
      handleReply,
      handleMessageContextMenu,
      handleImagePress,
      handleScrollToReply,
    ]
  );

  // ============== Loading State ==============
  if (messagesLoading) {
    return (
      <ChatScreenLayout>
        <ChatHeader
          title={otherParticipant?.name || 'Chat'}
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
      </ChatScreenLayout>
    );
  }

  // ============== Error State ==
  if (messagesError && !combinedMessages.length) {
    return (
      <ChatScreenLayout>
        <ChatHeader
          title={otherParticipant?.name || 'Chat'}
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
      </ChatScreenLayout>
    );
  }

  // ============== Main Render ==
  return (
    <ChatScreenLayout >
      <View style={{ flex: 1 }}>
        <ImageViewer
          visible={imageViewerVisible}
          imageUri={imageViewerUri}
          onClose={closeImageViewer}
          sourceLayout={imageSourceLayout}
          imageDimensions={imageViewerDimensions}
        />

        <ChatHeader
          title={otherParticipant?.name || 'Chat'}
          userId={otherParticipant?.id}
          lastSeen={otherParticipant?.lastSeen}
          userName={otherParticipant?.name}
          userAvatarUrl={otherParticipant?.avatarUrl}
          onLeavePress={handleOpenLeaveModal}
        />

        <View style={{ flex: 1, position: 'relative', backgroundColor: colors.bg.primary }}>
          <View style={{ flex: 1 }}>
            <FlatList
              ref={flatListRef}
              data={combinedMessages}
              keyExtractor={keyExtractor}
              inverted
              removeClippedSubviews={true}
              initialNumToRender={8}
              maxToRenderPerBatch={8}
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
                  {messagesError && combinedMessages.length > 0 && (
                    <View className="mx-4 my-2">
                      <ErrorState
                        error={messagesError as Error}
                        onRetry={fetchPreviousPage}
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
              ListEmptyComponent={<EmptyState title="No messages yet" description="Start the conversation" flipY flipX />}
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
              onPress={scrollToBottom}
            />
          </Animated.View>
        </View>

        {/* Typing Indicator - Only takes space when visible */}
        <TypingIndicator
          visible={isTypingIndicatorVisible}
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
            onPickImage={handlePickImage}
            onTakePhoto={handleTakePhoto}
            onPickAudio={handleStartRecording}
          />
        )}

        {/* Leave Conversation Modal */}
        <LeaveConversationModal
          visible={leaveModalVisible}
          conversationName={otherParticipant?.name || 'this conversation'}
          onClose={() => setLeaveModalVisible(false)}
          onConfirm={handleLeaveConversation}
          isLoading={leaveConversationMutation.isPending}
        />
      </View>
    </ChatScreenLayout>
  );
}
