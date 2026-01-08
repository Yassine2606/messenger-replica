import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useUploadImage, useSendMessage } from './index';
import { MessageType, Message } from '@/models';
import { pickImageFromLibrary, takePhotoWithCamera } from '@/lib/image-picker';

interface UseImageHandlersProps {
  conversationId: number;
  replyToMessage: Message | null;
  onReplyCleared: () => void;
}

export function useImageHandlers({
  conversationId,
  replyToMessage,
  onReplyCleared,
}: UseImageHandlersProps) {
  const uploadImageMutation = useUploadImage();
  const sendMutation = useSendMessage(conversationId);

  const handlePickImage = useCallback(async () => {
    const imageUri = await pickImageFromLibrary();
    if (imageUri) {
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
    }
  }, [conversationId, replyToMessage?.id, uploadImageMutation, sendMutation, onReplyCleared]);

  const handleTakePhoto = useCallback(async () => {
    const photoUri = await takePhotoWithCamera();
    if (photoUri) {
      try {
        const result = await uploadImageMutation.mutateAsync(photoUri);
        if (result.success) {
          sendMutation.mutate({
            conversationId,
            type: MessageType.IMAGE,
            mediaUrl: result.file.url,
            replyToId: replyToMessage?.id,
          });
          onReplyCleared();
        }
      } catch (error) {
        Alert.alert('Error', 'Failed to upload photo. Please try again.');
      }
    }
  }, [conversationId, replyToMessage?.id, uploadImageMutation, sendMutation, onReplyCleared]);

  return {
    handlePickImage,
    handleTakePhoto,
  };
}
