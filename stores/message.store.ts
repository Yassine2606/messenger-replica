import { create } from 'zustand';
import { Message, MessageType, ReadStatus } from '@/models';

/**
 * Zustand Store: OPTIMISTIC UI STATE ONLY
 * 
 * According to Socket.io + React Query blueprint:
 * - Stores temporary/optimistic message IDs while sending
 * - Tracks which messages are "in-flight" for loading spinners
 * - Removed as soon as server confirms via Socket event
 * 
 * ❌ NOT stored here:
 * - Actual messages (React Query infinite scroll cache)
 * - Message read status (React Query cache)
 * - Conversations (React Query cache)
 * 
 * ✅ Stored here:
 * - Optimistic messages being sent (before server confirmation)
 * - Temporary client-side IDs for UI feedback
 * - Message sending status (sending/sent/failed)
 */
interface MessageStoreState {
  // Map of tempId -> optimistic Message with status updates
  optimisticMessages: Map<string, Message>;
  nextOptimisticId: number;

  // Actions
  addOptimisticMessage: (tempId: string, message: Message) => Message;
  updateMessageStatus: (tempId: string, status: 'sending' | 'sent' | 'failed', serverId?: number) => void;
  removeOptimisticMessage: (tempId: string) => void;
  getOptimisticMessage: (tempId: string) => Message | undefined;
  clearAll: () => void;
}

export const useMessageStore = create<MessageStoreState>((set, get) => ({
  optimisticMessages: new Map(),
  nextOptimisticId: -1,

  /**
   * Add an optimistic message with 'sending' status
   * Returns the message with assigned negative ID
   */
  addOptimisticMessage: (tempId, message) => {
    let addedMessage: Message;
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      const uniqueId = state.nextOptimisticId;
      addedMessage = {
        ...message,
        id: uniqueId,
        reads: [
          {
            id: uniqueId,
            messageId: uniqueId,
            userId: message.senderId,
            status: ReadStatus.SENT, // Optimistic messages start as 'sending'
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
      };
      newMap.set(tempId, addedMessage);
      return {
        optimisticMessages: newMap,
        nextOptimisticId: uniqueId - 1,
      };
    });
    return addedMessage!;
  },

  /**
   * Update message status (sending -> sent -> failed)
   * Optionally replace temporary ID with server ID
   */
  updateMessageStatus: (tempId, status, serverId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      const msg = newMap.get(tempId);
      if (msg) {
        const statusMap = {
          sending: ReadStatus.SENT,
          sent: ReadStatus.DELIVERED,
          failed: ReadStatus.SENT, // Keep as sent but marked failed
        };
        const updatedMsg = {
          ...msg,
          ...(serverId && { id: serverId }),
          reads: msg.reads?.map((r) => ({
            ...r,
            status: statusMap[status],
          })) || [],
        };
        newMap.set(tempId, updatedMsg);
      }
      return { optimisticMessages: newMap };
    });
  },

  /**
   * Remove optimistic message (replaced by server message)
   */
  removeOptimisticMessage: (tempId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      newMap.delete(tempId);
      return { optimisticMessages: newMap };
    });
  },

  /**
   * Get optimistic message by tempId
   */
  getOptimisticMessage: (tempId) => {
    return get().optimisticMessages.get(tempId);
  },

  /**
   * Clear all optimistic messages
   */
  clearAll: () => {
    set({
      optimisticMessages: new Map(),
      nextOptimisticId: -1,
    });
  },
}));