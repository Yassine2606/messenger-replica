import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useSendMessage } from './useMessages';
import { useUploadAudio } from './useUpload';
import { MessageType, Message } from '@/models';

interface UseAudioHandlersProps {
  conversationId: number;
  replyToMessage: Message | null;
  onReplyCleared: () => void;
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<any>;
  cancelRecording: () => Promise<void>;
}

export function useAudioHandlers({
  conversationId,
  replyToMessage,
  onReplyCleared,
  startRecording,
  stopRecording,
  cancelRecording,
}: UseAudioHandlersProps) {
  const uploadAudioMutation = useUploadAudio();
  const sendMutation = useSendMessage(conversationId);

  const handleStartRecording = useCallback(async () => {
    try {
      await startRecording();
    } catch (error) {
      Alert.alert('Error', 'Failed to start recording. Check microphone permissions.');
    }
  }, [startRecording]);

  const handleStopRecording = useCallback(async () => {
    try {
      const recordingResult = await stopRecording();

      const uploadResult = await uploadAudioMutation.mutateAsync(recordingResult.uri);

      if (uploadResult.success) {
        const audioUrl = uploadResult.file.url.startsWith('http')
          ? uploadResult.file.url
          : `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api'}${uploadResult.file.url}`.replace('/api/uploads', '/uploads');

        sendMutation.mutate({
          conversationId,
          type: MessageType.AUDIO,
          mediaUrl: audioUrl,
          mediaMimeType: `audio/${recordingResult.mimeType}`,
          mediaDuration: recordingResult.duration,
          waveform: recordingResult.waveform,
          replyToId: replyToMessage?.id,
        });
        onReplyCleared();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Error', `Failed to send audio: ${errorMessage}`);
    }
  }, [stopRecording, uploadAudioMutation, sendMutation, conversationId, replyToMessage?.id, onReplyCleared]);

  const handleCancelRecording = useCallback(async () => {
    try {
      await cancelRecording();
    } catch (error) {
      console.error('Cancel recording error:', error);
    }
  }, [cancelRecording]);

  return {
    handleStartRecording,
    handleStopRecording,
    handleCancelRecording,
  };
}
