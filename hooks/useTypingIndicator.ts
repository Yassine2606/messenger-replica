import { useCallback, useRef, useState } from 'react';
import { socketClient } from '@/lib/socket';

interface UseTypingIndicatorProps {
  conversationId: number;
}

export function useTypingIndicator({ conversationId }: UseTypingIndicatorProps) {
  const [isTyping, setIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = useCallback(
    (text: string) => {
      // Send typing indicator
      if (!isTyping && text.length > 0) {
        setIsTyping(true);
        socketClient.startTyping(conversationId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 500ms of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        setIsTyping(false);
        socketClient.stopTyping(conversationId);
      }, 500);
    },
    [conversationId, isTyping]
  );

  return { handleTextChange, isTyping, typingTimeoutRef };
}
