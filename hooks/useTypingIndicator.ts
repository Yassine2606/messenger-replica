import { useCallback, useRef } from 'react';
import { socketClient } from '@/lib/socket';

interface UseTypingIndicatorProps {
  conversationId: number;
}

/**
 * Simplified typing indicator hook leveraging backend throttling
 * 
 * The backend throttles duplicate typing:start events at 1000ms per user per conversation,
 * so we don't need client-side deduplication. This significantly simplifies the hook and
 * reduces memory overhead.
 */
export function useTypingIndicator({ conversationId }: UseTypingIndicatorProps) {
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleTextChange = useCallback(
    (text: string) => {
      // Send typing indicator on any text input (backend handles throttling)
      if (text.length > 0) {
        socketClient.startTyping(conversationId);
      }

      // Clear existing timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      // Stop typing after 500ms of inactivity (UX preference)
      typingTimeoutRef.current = setTimeout(() => {
        socketClient.stopTyping(conversationId);
      }, 500);
    },
    [conversationId]
  );

  return { handleTextChange, typingTimeoutRef };
}
