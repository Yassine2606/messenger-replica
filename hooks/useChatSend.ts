import { useCallback, useRef } from 'react';
import { TextInput } from 'react-native';
import { useSendMessage, useUploadImage, useUploadAudio } from './index';
import { MessageType, Message } from '@/models';
import { Alert } from 'react-native';

interface UseChatSendProps {
  conversationId: number;
  messageText: string;
  replyToMessage: Message | null;
  onMessageCleared: () => void;
  onReplyCleared: () => void;
  inputRef: React.RefObject<TextInput>;
}

export function useChatSend({
  conversationId,
  messageText,
  replyToMessage,
  onMessageCleared,
  onReplyCleared,
  inputRef,
}: UseChatSendProps) {
  const messageTextRef = useRef(messageText);
  const sendMutation = useSendMessage(conversationId);
  const uploadImageMutation = useUploadImage();
  const uploadAudioMutation = useUploadAudio();

  // Keep ref in sync with state
  messageTextRef.current = messageText;

  const handleSendText = useCallback(() => {
    const trimmedText = messageTextRef.current.trim();
    if (!trimmedText) return;

    // Clear input immediately via native props
    inputRef.current?.setNativeProps({ text: '' });
    messageTextRef.current = '';

    // Send mutation
    sendMutation.mutate({
      conversationId,
      type: MessageType.TEXT,
      content: trimmedText,
      replyToId: replyToMessage?.id,
    });

    // Refocus multiple times to counter re-renders
    requestAnimationFrame(() => inputRef.current?.focus());
    setTimeout(() => inputRef.current?.focus(), 50);
    setTimeout(() => inputRef.current?.focus(), 150);
    setTimeout(() => inputRef.current?.focus(), 300);

    // Delay state clear
    setTimeout(() => {
      onMessageCleared();
      onReplyCleared();
    }, 400);
  }, [replyToMessage, conversationId, sendMutation, onMessageCleared, onReplyCleared, inputRef]);

  const handleSendImage = useCallback(
    async (imageUri: string) => {
      try {
        const result = await uploadImageMutation.mutateAsync(imageUri);

        if (result.success) {
          sendMutation.mutate({
            conversationId,
            type: MessageType.IMAGE,
            mediaUrl: result.file.url,
            replyToId: replyToMessage?.id,
          });
          onReplyCleared();
        } else {
          Alert.alert('Error', 'Upload was not successful');
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Failed to upload image: ${errorMsg}`);
      }
    },
    [conversationId, replyToMessage, uploadImageMutation, sendMutation, onReplyCleared]
  );

  const handleSendAudio = useCallback(
    async (audioUri: string, duration: number, waveform: number[], mimeType: string) => {
      try {
        const uploadResult = await uploadAudioMutation.mutateAsync(audioUri);

        if (uploadResult.success) {
          const audioUrl = uploadResult.file.url.startsWith('http')
            ? uploadResult.file.url
            : `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}${uploadResult.file.url}`.replace(
                '/api/uploads',
                '/uploads'
              );

          sendMutation.mutate({
            conversationId,
            type: MessageType.AUDIO,
            mediaUrl: audioUrl,
            mediaMimeType: `audio/${mimeType}`,
            mediaDuration: duration,
            waveform,
            replyToId: replyToMessage?.id,
          });
          onReplyCleared();
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        Alert.alert('Error', `Failed to upload audio: ${errorMsg}`);
      }
    },
    [conversationId, replyToMessage, uploadAudioMutation, sendMutation, onReplyCleared]
  );

  return {
    handleSendText,
    handleSendImage,
    handleSendAudio,
    isSending: sendMutation.isPending,
  };
}
