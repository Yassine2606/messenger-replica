import React, { useState, useRef, useCallback, useEffect } from 'react';
import { View, FlatList, TextInput, ActivityIndicator, Text, Alert, Keyboard, Pressable } from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { ChatHeader, ChatInputFooter, MessageItem, ScrollToBottom, TypingIndicator, BottomSheet } from '@/components/ui';
import {
  useInfiniteMessages,
  useSendMessage,
  useConversation,
  useMarkConversationAsReadOptimistic,
  useScrollToBottom,
  useBottomSheet,
} from '@/hooks';
import { useProfile } from '@/hooks/useAuth';
import { useDeleteMessage } from '@/hooks/useMessage';
import { useTypingIndicator, useListenTyping, useConversationRoom, useIncomingMessages } from '@/hooks/useSocket';
import { uploadService } from '@/services';
import type { Message, MessageType } from '@/models';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = parseInt(id || '0', 10);
  const inputRef = useRef<TextInput>(null);

  // ============== Data & State ==============
  const { data: user } = useProfile();
  const { data: conversation, isLoading: conversationLoading } = useConversation(conversationId);
  const {
    data: infiniteData,
    isLoading: messagesLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMessages(conversationId);

  const sendMessageMutation = useSendMessage();
  const markAsReadOptimistic = useMarkConversationAsReadOptimistic();
  const deleteMessageMutation = useDeleteMessage();

  // Local state
  const [messageText, setMessageText] = useState('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);

  // Bottom sheet
  const bottomSheet = useBottomSheet();
  const insets = useSafeAreaInsets();

  // ============== Refs ==============
  const flatListRef = useRef<FlatList>(null);
  const keyboardDismissTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const sendInProgressRef = useRef(false);

  // ============== Animated Values ==============
  const sharedRowTranslateX = useSharedValue(0);
  const sharedTimestampOpacity = useSharedValue(0);

  // ============== Socket & Typing ==============
  useConversationRoom(conversationId);
  useIncomingMessages(conversationId);

  const { startTyping, stopTyping } = useTypingIndicator(conversationId);
  const otherParticipant = conversation?.participants?.find((p) => p.id !== user?.id);
  const otherUserIsTyping = useListenTyping(conversationId, otherParticipant?.id || null);

  // ============== Scroll Hook ==============
  const { showButton: showScrollToBottom, handleScroll, scrollToBottom, cleanup } = useScrollToBottom(flatListRef);

  // ============== Keyboard Event Listeners ==============
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', () => {
      setIsKeyboardVisible(true);
      if (keyboardDismissTimeoutRef.current) {
        clearTimeout(keyboardDismissTimeoutRef.current);
        keyboardDismissTimeoutRef.current = null;
      }
    });

    return () => {
      showListener.remove();
      if (keyboardDismissTimeoutRef.current) {
        clearTimeout(keyboardDismissTimeoutRef.current);
      }
    };
  }, []);

  // ============== Focus Effects ==============
  useFocusEffect(
    useCallback(() => {
      if (conversationId && user?.id) {
        markAsReadOptimistic(conversationId);
      }
    }, [conversationId, user?.id, markAsReadOptimistic])
  );

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  // ============== Message Actions ==============
  const handleMessageLongPress = useCallback((message: Message) => {
    // Only allow actions on own messages
    if (message.senderId !== user?.id) {
      return;
    }
    setSelectedMessage(message);
    bottomSheet.open();
  }, [bottomSheet, user?.id]);

  const handleDeleteMessage = useCallback(async () => {
    if (!selectedMessage) return;

    Alert.alert(
      'Delete Message',
      'Are you sure you want to delete this message?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteMessageMutation.mutateAsync(selectedMessage.id);
              bottomSheet.close();
              setSelectedMessage(null);
            } catch (error) {
              console.error('Delete error:', error);
              Alert.alert('Error', 'Failed to delete message');
            }
          },
        },
      ]
    );
  }, [selectedMessage, deleteMessageMutation, bottomSheet]);

  const handleEditMessage = useCallback(() => {
    if (!selectedMessage || selectedMessage.type !== 'text') return;
    setEditingMessage(selectedMessage);
    setMessageText(selectedMessage.content || '');
    bottomSheet.close();
    setSelectedMessage(null);
    // Focus input after a short delay
    setTimeout(() => inputRef.current?.focus(), 100);
  }, [selectedMessage, bottomSheet]);

  const cancelEdit = useCallback(() => {
    setEditingMessage(null);
    setMessageText('');
  }, []);

  // ============== Message Sending ==============
  const handleSend = useCallback(async () => {
    const trimmedText = messageText.trim();
    if (!trimmedText || sendMessageMutation.isPending || sendInProgressRef.current) return;

    // TODO: Handle edit message when backend supports it
    if (editingMessage) {
      Alert.alert('Coming Soon', 'Message editing will be available soon');
      cancelEdit();
      return;
    }

    sendInProgressRef.current = true;
    const replyId = replyToMessage?.id;

    stopTyping();
    setMessageText('');
    setReplyToMessage(null);

    try {
      await sendMessageMutation.mutateAsync({
        conversationId,
        type: 'text' as MessageType,
        content: trimmedText,
        replyToId: replyId,
      });
    } catch (error) {
      setMessageText(trimmedText);
      if (replyId && replyToMessage) {
        setReplyToMessage(replyToMessage);
      }
      console.error('Failed to send message:', error);
    } finally {
      sendInProgressRef.current = false;
      // Explicit focus after send completes
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [messageText, replyToMessage, sendMessageMutation, conversationId, stopTyping]);

  // ============== Text Change ==============
  const handleMessageTextChange = useCallback(
    (text: string) => {
      setMessageText(text);
      if (text.trim().length > 0) {
        startTyping();
      } else {
        stopTyping();
      }
    },
    [startTyping, stopTyping]
  );

  // ============== Reply Handlers ==============
  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  // ============== Media Handlers ==============
  const handlePickImage = useCallback(async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please grant photo library access to send images');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
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

  // ============== Pagination ==============
  const handleEndReached = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // ============== Loading State ==============
  if (conversationLoading || messagesLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  // ============== Message Processing ==============
  const messages = infiniteData?.pages?.flat() || [];
  const sortedMessages = [...messages].sort((a, b) => {
    const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return timeB - timeA;
  });

  const lastOwnMessage = sortedMessages.find((msg) => msg.senderId === user?.id);

  // ============== Render ==============
  return (
    <KeyboardAvoidingView
      className="flex-1 bg-white"
      behavior="padding"
      keyboardVerticalOffset={0}>
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
        onEndReached={handleEndReached}
        onEndReachedThreshold={2}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View className="py-4 items-center">
              <ActivityIndicator size="small" color="#3B82F6" />
            </View>
          ) : null
        }
        renderItem={({ item, index }) => {
          const isOwn = item.senderId === user?.id;
          const isLastOwnMessage = isOwn && item.id === lastOwnMessage?.id;
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
              onLongPress={handleMessageLongPress}
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

      <TypingIndicator visible={otherUserIsTyping} userName={otherParticipant?.name} />

      <ScrollToBottom visible={showScrollToBottom} onPress={scrollToBottom} />

      <ChatInputFooter
        messageText={messageText}
        onChangeText={handleMessageTextChange}
        onSend={handleSend}
        replyToMessage={editingMessage || replyToMessage}
        onCancelReply={editingMessage ? cancelEdit : cancelReply}
        sendingMessage={sendMessageMutation.isPending || uploading}
        inputRef={inputRef}
        onPickImage={handlePickImage}
        onTakePhoto={handleTakePhoto}
        onPickAudio={handlePickAudio}
      />

      {/* Message Actions Bottom Sheet */}
      <BottomSheet
        ref={bottomSheet.ref}
        isOpen={bottomSheet.isOpen}
        onClose={bottomSheet.close}
        snapPoints={['30%']}
        enableBackdropDismiss
      >
        <View style={{ paddingBottom: insets.bottom + 10, paddingHorizontal: 20, paddingTop: 10 }}>
          <Text className="text-lg font-semibold text-gray-900 mb-4">Message Actions</Text>

          {selectedMessage?.type === 'image' ? (
            // Image message: only delete
            <Pressable
              onPress={handleDeleteMessage}
              className="flex-row items-center py-4 border-b border-gray-100 active:bg-gray-50"
            >
              <Ionicons name="trash-outline" size={24} color="#EF4444" />
              <Text className="ml-3 text-base text-red-500 font-medium">Delete Image</Text>
            </Pressable>
          ) : (
            // Text message: edit and delete
            <>
              <Pressable
                onPress={handleEditMessage}
                className="flex-row items-center py-4 border-b border-gray-100 active:bg-gray-50"
              >
                <Ionicons name="pencil-outline" size={24} color="#3B82F6" />
                <Text className="ml-3 text-base text-gray-900 font-medium">Edit Message</Text>
              </Pressable>
              <Pressable
                onPress={handleDeleteMessage}
                className="flex-row items-center py-4 active:bg-gray-50"
              >
                <Ionicons name="trash-outline" size={24} color="#EF4444" />
                <Text className="ml-3 text-base text-red-500 font-medium">Delete Message</Text>
              </Pressable>
            </>
          )}
        </View>
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}
