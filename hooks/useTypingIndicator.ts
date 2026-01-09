import { useCallback, useRef } from 'react';
import { socketClient } from '@/lib/socket';

interface UseTypingIndicatorProps {
  conversationId: number;
}

export function useTypingIndicator({ conversationId }: UseTypingIndicatorProps) {
  const isTypingRef = useRef(false); // Use ref to avoid stale closure
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = useCallback(
    (text: string) => {
      // Send typing indicator only if not already typing
      if (!isTypingRef.current && text.length > 0) {
        isTypingRef.current = true;
        socketClient.startTyping(conversationId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 500ms of inactivity
      typingTimeoutRef.current = setTimeout(() => {
        isTypingRef.current = false;
        socketClient.stopTyping(conversationId);
      }, 500);
    },
    [conversationId] // ✅ No isTyping dependency - eliminates closure stale issue
  );

  return { handleTextChange, typingTimeoutRef };
}
