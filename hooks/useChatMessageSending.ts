import { useState, useCallback, useEffect, useRef } from 'react';
import { TextInput } from 'react-native';
import { Message, MessageType } from '@/models';
import { useSendMessage } from './useMessages';

/**
 * Manages message sending, reply state, and input focus
 */
export function useChatMessageSending(conversationId: number) {
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const inputRef = useRef<TextInput>(null);
  const sendMutation = useSendMessage(conversationId);

  // Focus input when reply is activated
  useEffect(() => {
    if (replyToMessage) {
      inputRef.current?.focus();
    }
  }, [replyToMessage]);

  const handleSend = useCallback(
    (text: string) => {
      const trimmedText = text.trim();
      if (!trimmedText) return;

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
          },
          onError: (error) => {
            console.error('Failed to send message:', error);
            // Text stays for retry
          },
        }
      );
    },
    [replyToMessage, sendMutation, conversationId]
  );

  const handleReply = useCallback((message: Message) => {
    setReplyToMessage(message);
  }, []);

  const cancelReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  const clearReply = useCallback(() => {
    setReplyToMessage(null);
  }, []);

  return {
    replyToMessage,
    setReplyToMessage,
    inputRef,
    handleSend,
    handleReply,
    cancelReply,
    clearReply,
    sendMutation,
  };
}
