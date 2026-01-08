import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { View, TextInput, ActivityIndicator, Text, FlatList, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSharedValue, useAnimatedStyle, useAnimatedReaction, runOnJS } from 'react-native-reanimated';
import Animated from 'react-native-reanimated';
import { ChatHeader, ChatInputFooter, MessageBubble, ScrollToBottom, ErrorBoundary, ErrorState, MessageStatus, TypingIndicator, TimeSeparator, ImageViewer, AudioRecordingControls, AudioWavePlayer } from '@/components/ui';
import { useInfiniteMessages, useSendMessage, useProfile, useGetConversation, useUploadImage, useUploadAudio, useAudioRecording } from '@/hooks';
import { useMessageStore, useUserStore } from '@/stores';
import { socketClient } from '@/lib/socket';
import { SPACING, MESSAGE } from '@/lib';
import { pickImageFromLibrary, takePhotoWithCamera } from '@/lib/image-picker';
import { Message, MessageType } from '@/models';
import { Ionicons } from '@expo/vector-icons';

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
  const uploadImageMutation = useUploadImage();
  const uploadAudioMutation = useUploadAudio();
  
  // Audio recording
  const {
    isRecording,
    duration: recordingDuration,
    currentWaveform,
    error: recordingError,
    startRecording,
    stopRecording,
    cancelRecording,
  } = useAudioRecording();

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
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [imageViewerUri, setImageViewerUri] = useState('');
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
    }, 500);
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

  const handleImagePress = useCallback((imageUri: string) => {
    const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:3000';
    setImageViewerUri(`${API_BASE_URL}${imageUri}`);
    setImageViewerVisible(true);
  }, []);

  // ============== Image Picker Handlers ==============
  const handlePickImage = useCallback(async () => {
    const imageUri = await pickImageFromLibrary();
    if (imageUri) {
      // Upload image and send message
      try {
        console.log('Starting image upload:', imageUri);
        const result = await uploadImageMutation.mutateAsync(imageUri);
        console.log('Image upload result:', result);
        
        if (result.success) {
          console.log('Sending image message with URL:', result.file.url);
          sendMutation.mutate({
            conversationId,
            type: MessageType.IMAGE,
            mediaUrl: result.file.url,
            replyToId: replyToMessage?.id,
          });
          setReplyToMessage(null);
        } else {
          Alert.alert('Error', 'Upload was not successful');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('Image upload failed:', error);
        Alert.alert('Error', `Failed to upload image: ${errorMsg}`);
      }
    }
  }, [conversationId, replyToMessage, uploadImageMutation, sendMutation]);

  const handleTakePhoto = useCallback(async () => {
    const photoUri = await takePhotoWithCamera();
    if (photoUri) {
      // Upload photo and send message
      try {
        const result = await uploadImageMutation.mutateAsync(photoUri);
        if (result.success) {
          sendMutation.mutate({
            conversationId,
            type: MessageType.IMAGE,
            mediaUrl: result.file.url,
            replyToId: replyToMessage?.id,
          });
          setReplyToMessage(null);
        }
      } catch (error) {
        console.error('Photo upload failed:', error);
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
      }
    }
  }, [conversationId, replyToMessage, uploadImageMutation, sendMutation]);

  // ============== Audio Recording Handlers ==============
  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
    } catch (error) {
      console.error('Start recording error:', error);
      Alert.alert('Error', 'Failed to start recording. Check microphone permissions.');
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    try {
      const recordingResult = await stopRecording();
      console.log('Recording result:', {
        uri: recordingResult.uri,
        duration: recordingResult.duration,
        waveformLength: recordingResult.waveform.length,
        mimeType: recordingResult.mimeType,
      });
      
      // Upload audio file
      console.log('Uploading audio from URI:', recordingResult.uri);
      const uploadResult = await uploadAudioMutation.mutateAsync(recordingResult.uri);
      
      if (uploadResult.success) {
        console.log('Upload successful:', uploadResult.file.url);
        // Send audio message with waveform
        sendMutation.mutate({
          conversationId,
          type: MessageType.AUDIO,
          mediaUrl: uploadResult.file.url,
          mediaMimeType: `audio/${recordingResult.mimeType}`,
          mediaDuration: recordingResult.duration,
          waveform: recordingResult.waveform,
          replyToId: replyToMessage?.id,
        });
        setReplyToMessage(null);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Recording error:', error);
      Alert.alert('Error', `Failed to send audio: ${errorMessage}`);
    }
  }, [stopRecording, uploadAudioMutation, sendMutation, conversationId, replyToMessage]);

  const handleCancelRecording = useCallback(async () => {
    try {
      await cancelRecording();
    } catch (error) {
      console.error('Cancel recording error:', error);
    }
  }, [cancelRecording]);

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
            onImagePress={handleImagePress}
            onScrollToReply={handleScrollToReply}
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
      <View className="flex-1 bg-white">
        <ChatHeader title={`${user?.name || 'Chat'}`} />
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
        <ChatHeader title={`${user?.name || 'Chat'}`} />
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
    <View className="flex-1 bg-white">
      <ImageViewer visible={imageViewerVisible} imageUri={imageViewerUri} onClose={() => setImageViewerVisible(false)} />
      <ChatHeader title={`${user?.name || 'Chat'}`} />

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
            <ScrollToBottom visible={buttonVisible} onPress={() => flatListRef.current?.scrollToOffset({ offset: 0, animated: true })} />
          </Animated.View>
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
      </KeyboardAvoidingView>
    </View>
  );
}
