import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, TextInput, ActivityIndicator, Text, FlatList, Alert, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { ChatHeader, ChatInputFooter, MessageBubble, ScrollToBottom, ErrorBoundary, ErrorState, MessageStatus, TypingIndicator, TimeSeparator, ImageViewer, AudioRecordingControls, VoiceMessagePlayer, MessageContextMenuModal } from '@/components/ui';
import { useInfiniteMessages, useProfile, useGetConversation, useDeleteMessage, useAudioHandlers, useImageHandlers, useTypingIndicator, useAudioRecording, useSendMessage } from '@/hooks';
import { useMessageStore, useUserStore } from '@/stores';
import { socketClient } from '@/lib/socket';
import { SPACING, MESSAGE } from '@/lib';
import { Message, MessageType } from '@/models';
import { Ionicons } from '@expo/vector-icons';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = parseInt(id || '0', 10);
  const inputRef = useRef<TextInput>(null);

  // ============== Context Menu ==============
  const [activeContextMessage, setActiveContextMessage] = useState<Message | null>(null);
  const deleteMessageMutation = useDeleteMessage(conversationId);

  const handleMessageContextMenu = useCallback((message: Message) => {
    setActiveContextMessage(message);
  }, []);

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
  
  // ============== Socket/Room ==============
  useEffect(() => {
    socketClient.joinConversation(conversationId);
    return () => {
      socketClient.leaveConversation(conversationId);
    };
  }, [conversationId]);

  // ============== Input State ==============
  const [messageText, setMessageText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerUri, setImageViewerUri] = useState('');
  const [imageSourceLayout, setImageSourceLayout] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | undefined>();
  const { isUserTyping } = useUserStore();
  const otherParticipant = conversation?.participants?.find((p) => p.id !== user?.id);

  // ============== Typing Indicator Hook ==============
  const { handleTextChange: handleTypingIndicator } = useTypingIndicator({ conversationId });
  const sendMutation = useSendMessage(conversationId);

  const handleMessageTextChange = useCallback((text: string) => {
    // Prevent changes while sending
    if (sendMutation.isPending) return;
    setMessageText(text);
    handleTypingIndicator(text);
  }, [handleTypingIndicator, sendMutation.isPending]);

  // ============== Image Handlers Hook ==============
  const { handlePickImage, handleTakePhoto } = useImageHandlers({
    conversationId,
    replyToMessage,
    onReplyCleared: () => setReplyToMessage(null),
  });

  // ============== Audio Handlers Hook ==============
  const audioRecording = useAudioRecording();
  const { isRecording, duration: recordingDuration, currentWaveform } = audioRecording;
  const { handleStartRecording, handleStopRecording, handleCancelRecording } = useAudioHandlers({
    conversationId,
    replyToMessage,
    onReplyCleared: () => setReplyToMessage(null),
    startRecording: audioRecording.startRecording,
    stopRecording: audioRecording.stopRecording,
    cancelRecording: audioRecording.cancelRecording,
  });

  // ============== Send Message Hook ==============

  const handleSend = useCallback(() => {
    const trimmedText = messageText.trim();
    if (!trimmedText) return;

    // Send message immediately without clearing state first
    sendMutation.mutate({
      conversationId,
      type: MessageType.TEXT,
      content: trimmedText,
      replyToId: replyToMessage?.id,
    }, {
      onSuccess: () => {
        // Clear state AFTER successful send (optimistic update already in place)
        setMessageText('');
        setReplyToMessage(null);
      },
      onError: (error) => {
        console.error('Failed to send message:', error);
        // Text stays for retry
      },
    });
  }, [messageText, replyToMessage, sendMutation]);

  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleImagePress = useCallback((imageUri: string, layout?: { x: number; y: number; width: number; height: number }) => {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
    setImageViewerUri(`${API_BASE_URL}${imageUri}`);
    setImageSourceLayout(layout);
    setImageViewerVisible(true);
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

  const handleScrollToReply = useCallback(async (message: Message) => {
    if (!message.replyTo || !message.replyTo.id) return;
    const index = combinedMessages.findIndex(msg => msg.id === message.replyTo!.id);
    if (index !== -1) {
      flatListRef.current?.scrollToIndex({ index, animated: true });
    }
  }, [combinedMessages]);

  // ============== Shared Animated Values ==============
  const sharedRowTranslateX = useSharedValue(0);
  const sharedTimestampOpacity = useSharedValue(0);

  // ============== Refs ==============
  const flatListRef = useRef<FlatList<Message>>(null);
  const messageAreaRef = useRef<View>(null);
  
  // ============== Show scroll button when not at top (inverted) ==============
  const shouldShowButton = useSharedValue(0);
  const [buttonVisible, setButtonVisible] = useState(false);
  
  useAnimatedReaction(() => shouldShowButton.value, (value) => {
    runOnJS(setButtonVisible)(value > 0.5);
  });
  
  const showScrollButtonStyle = useAnimatedStyle(() => ({
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
    const isNearTop = contentOffsetY <= 1000;
    shouldShowButton.value = isNearTop ? 0 : 1;
  }, [shouldShowButton]);
  const renderItem = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.id;
    // Check if this is the last own message (most recent own message - first in inverted list)
    const isLastOwnMessage = isOwn && !combinedMessages.slice(0, index).some(msg => msg.senderId === user?.id);
    
    // Safe array bounds checking
    const previousMessage = index + 1 < combinedMessages.length ? combinedMessages[index + 1] : undefined;
    const nextMessage = index > 0 ? combinedMessages[index - 1] : undefined;

    // Check if we need to show time separator (time gap exceeds grouping threshold)
    const showTimeSeparator = previousMessage && Math.abs(
      new Date(item.createdAt).getTime() - new Date(previousMessage.createdAt).getTime()
    ) > MESSAGE.GROUPING_TIME_THRESHOLD;

    return (
      <ErrorBoundary componentName="MessageBubble">
        <View>
          {showTimeSeparator && <TimeSeparator date={item.createdAt} />}
          <MessageBubble
            message={item}
            previousMessage={previousMessage}
            nextMessage={nextMessage}
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
                audioUrl={item.mediaUrl.startsWith('http') ? item.mediaUrl : `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}${item.mediaUrl}`.replace('/api/uploads', '/uploads')}
                waveform={item.waveform || []}
                duration={item.mediaDuration || 0}
                isOwn={isOwn}
                message={item}
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
  }, [combinedMessages, user?.id, handleReply, handleMessageContextMenu, handleImagePress, sharedRowTranslateX, sharedTimestampOpacity]);

  // ============== Loading State ==============
  if (messagesLoading) {
    return (
      <View className="flex-1 bg-white">
        <ChatHeader title={`${otherParticipant?.name || 'Chat'}`} userId={otherParticipant?.id} lastSeen={otherParticipant?.lastSeen} userName={otherParticipant?.name} userAvatarUrl={otherParticipant?.avatarUrl} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3B82F6" />
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
          onPickAudio={handleStartRecording}
        />
      </View>
    );
  }

  // ============== Error State ==============
  if (messagesError && !messages.length) {
    return (
      <View className="flex-1 bg-white">
        <ChatHeader title={`${otherParticipant?.name || 'Chat'}`} userId={otherParticipant?.id} lastSeen={otherParticipant?.lastSeen} userName={otherParticipant?.name} userAvatarUrl={otherParticipant?.avatarUrl} />
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
          onPickAudio={handleStartRecording}
        />
      </View>
    );
  }

  // ============== Render ==============
  return (
    <KeyboardAvoidingView behavior={ Platform.OS === 'ios' ? 'padding' : 'height' } style={{ flex: 1 }}>
      <View className="flex-1 bg-white">
        <ImageViewer visible={imageViewerVisible} imageUri={imageViewerUri} onClose={() => setImageViewerVisible(false)} sourceLayout={imageSourceLayout} />

        <ChatHeader title={`${otherParticipant?.name || 'Chat'}`} userId={otherParticipant?.id} lastSeen={otherParticipant?.lastSeen} userName={otherParticipant?.name} userAvatarUrl={otherParticipant?.avatarUrl} />

        <View ref={messageAreaRef} style={{ flex: 1, position: 'relative' }}>
          <FlatList
            ref={flatListRef}
            data={combinedMessages}
            keyExtractor={keyExtractor}
            inverted
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="never"
            maintainVisibleContentPosition={{ minIndexForVisible: 0, autoscrollToTopThreshold: 10 }}
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
                <Ionicons name="chatbubble-ellipses-outline" size={48} color="#9CA3AF" />
                <Text className="text-base text-gray-400">No messages yet</Text>
                <Text className="mt-1 text-sm text-gray-400">Start the conversation</Text>
              </View>
            }
          />
          
          <Animated.View
            style={[
              { position: 'absolute', bottom: 10, left: 0, right: 0, alignItems: 'center', zIndex: 0 },
              showScrollButtonStyle,
            ]}
            pointerEvents="box-none">
            <ScrollToBottom visible={buttonVisible} onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: false })} />
          </Animated.View>

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

        {/* Typing Indicator - Only takes space when visible */}
        <TypingIndicator
          visible={otherParticipant?.id ? isUserTyping(otherParticipant.id) : false}
          userName={otherParticipant?.name}
        />

        {/* Recording Controls - Shown while recording */}
        <AudioRecordingControls
          isRecording={isRecording}
          duration={recordingDuration}
          waveform={currentWaveform}
          onStop={handleStopRecording}
          onCancel={handleCancelRecording}
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
          onPickAudio={handleStartRecording}
        />
    </View>
    </KeyboardAvoidingView>
  );
}
