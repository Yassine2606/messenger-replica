import React, { useState, useRef, useCallback } from 'react';
import { View, FlatList, TextInput, ActivityIndicator, Text, Alert } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';
import * as ImagePicker from 'expo-image-picker';
import { ChatHeader, ChatInputFooter, MessageItem, ScrollToBottom, TypingIndicator } from '@/components/ui';
import {
  useMessages,
  useSendMessage,
  useConversation,
} from '@/hooks';
import { useProfile } from '@/hooks/useAuth';
import { useSocketMessages, useTypingIndicator, useListenTyping, useConversationRoom } from '@/hooks/useSocket';
import { uploadService } from '@/services';
import type { Message, MessageType } from '@/models';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = parseInt(id || '0', 10);

  // Data fetching
  const { data: user } = useProfile();
  const { data: conversation, isLoading: conversationLoading } = useConversation(conversationId);
  const { data: messages = [], isLoading: messagesLoading, refetch: refetchMessages } = useMessages(conversationId);

  // Mutations
  const sendMessageMutation = useSendMessage();

  // Socket management - room joining, message listeners
  useConversationRoom(conversationId);
  useSocketMessages(conversationId);

    // Get other participant
  const otherParticipant = conversation?.participants?.find((p) => p.id !== user?.id);

  // Typing indicators
  const { startTyping, stopTyping } = useTypingIndicator(conversationId);
  const otherUserIsTyping = useListenTyping(conversationId, otherParticipant?.id || null);

  // Local state
  const [messageText, setMessageText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [uploading, setUploading] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Shared animated values for list-wide timestamp reveal
  const sharedRowTranslateX = useSharedValue(0);
  const sharedTimestampOpacity = useSharedValue(0);

  // Refetch messages when screen gains focus
  useFocusEffect(
    useCallback(() => {
      console.log('[ChatScreen] Screen focused, refetching messages', {
        conversationId,
        userId: user?.id,
      });
      
      // Refetch messages to ensure we have latest
      refetchMessages();
    }, [conversationId, refetchMessages, user?.id])
  );

  const handleSend = useCallback(async () => {
    const trimmedText = messageText.trim();
    if (!trimmedText || sendMessageMutation.isPending) return;

    const replyId = replyToMessage?.id;

    // Stop typing before sending
    stopTyping();

    // Clear input immediately for better UX
    setMessageText('');
    setReplyToMessage(null);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        type: 'text' as MessageType,
        content: trimmedText,
        replyToId: replyId,
      });

      // Refocus input after send
    } catch (error) {
      // Restore message on error
      setMessageText(trimmedText);
      if (replyId && replyToMessage) {
        setReplyToMessage(replyToMessage);
      }
      console.error('Failed to send message:', error);
    }
  }, [messageText, sendMessageMutation, conversationId, replyToMessage, stopTyping]);

  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
    inputRef.current?.focus();
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const handleMessageTextChange = useCallback((text: string) => {
    setMessageText(text);
    // Send typing indicator
    if (text.trim().length > 0) {
      startTyping();
    } else {
      stopTyping();
    }
  }, [startTyping, stopTyping]);

  const handleScroll = useCallback(({ nativeEvent }: any) => {
    const { contentOffset } = nativeEvent;
    // With inverted list: contentOffset.y near 0 = at bottom (latest messages)
    // contentOffset.y > threshold = scrolled up (older messages)
    const isNearBottom = contentOffset.y < 50;
    setShowScrollToBottom(!isNearBottom);
  }, []);

  const handleScrollToBottom = useCallback(() => {
    setShowScrollToBottom(false);
    // With inverted list, scroll to offset 0 to see latest messages
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  }, []);

  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant photo library access to send images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: [ 'images', 'videos'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        console.log('Uploading image:', result.assets[0].uri);
        const uploadResult = await uploadService.uploadFile(result.assets[0].uri, 'image');
        console.log('Upload success:', uploadResult);
        
        await sendMessageMutation.mutateAsync({
          conversationId,
          type: 'image' as MessageType,
          mediaUrl: uploadResult.file.url,
          mediaMimeType: uploadResult.file.mimeType,
        });
      }
    } catch (error: any) {
      console.error('Image upload error:', error);
      Alert.alert('Error', error?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  }, [conversationId, sendMessageMutation]);

  const handleTakePhoto = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant camera access to take photos');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        setUploading(true);
        const uploadResult = await uploadService.uploadFile(result.assets[0].uri, 'image');
        
        await sendMessageMutation.mutateAsync({
          conversationId,
          type: 'image' as MessageType,
          mediaUrl: uploadResult.file.url,
          mediaMimeType: uploadResult.file.mimeType,
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to take photo');
      console.error('Photo error:', error);
    } finally {
      setUploading(false);
    }
  }, [conversationId, sendMessageMutation]);

  const handlePickAudio = useCallback(async () => {
    Alert.alert('Audio', 'Audio recording coming soon');
  }, []);

  if (conversationLoading || messagesLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // Sort newest to oldest, then inverted prop flips it so newest appears at bottom
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  // Find last own message for read status indicator (first in sorted array since newest first)
  const lastOwnMessage = sortedMessages.find((msg) => msg.senderId === user?.id);

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior="padding"
      keyboardVerticalOffset={0}
      style={{ flex: 1 }}>
      <ChatHeader 
        title={otherParticipant?.name || 'Chat'} 
        isOnline={otherParticipant?.status === 'online' && !!otherParticipant?.id}
      />

      <FlatList
        ref={flatListRef}
        data={sortedMessages}
        inverted
        keyExtractor={(item) => `msg-${item.id}`}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        renderItem={({ item, index }) => {
          const isOwn = item.senderId === user?.id;
          const isLastOwnMessage = isOwn && item.id === lastOwnMessage?.id;
          
          // For inverted list: previous is at index + 1, next is at index - 1
          const previousMessage = sortedMessages[index + 1];
          const nextMessage = sortedMessages[index - 1];

          return (
            <MessageItem
              message={item}
              previousMessage={previousMessage}
              nextMessage={nextMessage}
              isOwn={isOwn}
              isLastOwnMessage={isLastOwnMessage}
              currentUserId={user?.id}
              onReply={handleReply}
              sharedRowTranslateX={sharedRowTranslateX}
              sharedTimestampOpacity={sharedTimestampOpacity}
            />
          );
        }}
        contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-20">
            <Text className="text-base text-gray-400">No messages yet</Text>
            <Text className="mt-1 text-sm text-gray-400">Start the conversation</Text>
          </View>
        }
      />

      <TypingIndicator 
        visible={otherUserIsTyping} 
        userName={otherParticipant?.name}
      />

      {showScrollToBottom && (
        <View 
          className="absolute left-0 right-0 items-center z-10" 
          style={{ bottom: 72, pointerEvents: 'box-none' }}>
          <ScrollToBottom visible={showScrollToBottom} onPress={handleScrollToBottom} />
        </View>
      )}

      <ChatInputFooter
        messageText={messageText}
        onChangeText={handleMessageTextChange}
        onSend={handleSend}
        replyToMessage={replyToMessage}
        onCancelReply={cancelReply}
        sendingMessage={sendMessageMutation.isPending || uploading}
        inputRef={inputRef}
        onPickImage={handlePickImage}
        onTakePhoto={handleTakePhoto}
        onPickAudio={handlePickAudio}
      />
    </KeyboardAvoidingView>
  );
}
