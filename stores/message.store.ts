import { create } from 'zustand';
import { Message, ReadStatus } from '@/models';

interface MessageQueueItem {
  tempId: string;
  message: Message;
  conversationId: number;
}

interface MessageStoreState {
  optimisticMessages: Map<string, Message>; // tempId -> Message
  queue: MessageQueueItem[];
  nextOptimisticId: number; // Counter for unique negative IDs

  // Actions
  addOptimisticMessage: (tempId: string, message: Message, conversationId: number) => void;
  removeOptimisticMessage: (tempId: string) => void;
  confirmOptimisticMessage: (tempId: string, actualMessage: Message) => void;
  failOptimisticMessage: (tempId: string) => void;
  markAsDelivered: (messageId: number) => void;
  markAsRead: (messageId: number) => void;
  getOptimisticMessage: (tempId: string) => Message | undefined;
  hasOptimisticMessage: (tempId: string) => boolean;
  clearByConversation: (conversationId: number) => void;
}

export const useMessageStore = create<MessageStoreState>((set, get) => ({
  optimisticMessages: new Map(),
  queue: [],
  nextOptimisticId: -1,

  addOptimisticMessage: (tempId, message, conversationId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      const uniqueId = state.nextOptimisticId; // Use counter for unique IDs
      // Attach tempId to message for identification
      const messageWithTempId = { ...message, id: uniqueId, tempId } as any;
      newMap.set(tempId, messageWithTempId);
      return {
        optimisticMessages: newMap,
        queue: [...state.queue, { tempId, message: messageWithTempId, conversationId }],
        nextOptimisticId: uniqueId - 1, // Decrement for next optimistic message
      };
    });
  },

  removeOptimisticMessage: (tempId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      newMap.delete(tempId);
      return {
        optimisticMessages: newMap,
        queue: state.queue.filter((item) => item.tempId !== tempId),
      };
    });
  },

  confirmOptimisticMessage: (tempId, actualMessage) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      newMap.delete(tempId);
      return {
        optimisticMessages: newMap,
        queue: state.queue.filter((item) => item.tempId !== tempId),
      };
    });
  },

  failOptimisticMessage: (tempId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      const msg = newMap.get(tempId);
      if (msg) {
        newMap.set(tempId, { ...msg });
      }
      return { optimisticMessages: newMap };
    });
  },

  markAsDelivered: (messageId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      newMap.forEach((msg, key) => {
        if (msg.id === messageId) {
          // Update reads array
          const updatedMsg = {
            ...msg,
            reads: msg.reads?.map((r) => (r.status === ReadStatus.SENT ? { ...r, status: ReadStatus.DELIVERED } : r)) || [],
          };
          newMap.set(key, updatedMsg);
        }
      });
      return { optimisticMessages: newMap };
    });
  },

  markAsRead: (messageId) => {
    set((state) => {
      const newMap = new Map(state.optimisticMessages);
      newMap.forEach((msg, key) => {
        if (msg.id === messageId) {
          const updatedMsg = {
            ...msg,
            reads: msg.reads?.map((r) => (r.status !== ReadStatus.READ ? { ...r, status: ReadStatus.READ } : r)) || [],
          };
          newMap.set(key, updatedMsg);
        }
      });
      return { optimisticMessages: newMap };
    });
  },

  getOptimisticMessage: (tempId) => {
    return get().optimisticMessages.get(tempId);
  },

  hasOptimisticMessage: (tempId) => {
    return get().optimisticMessages.has(tempId);
  },

  clearByConversation: (conversationId) => {
    set((state) => {
      const itemsToKeep = state.queue.filter((item) => item.conversationId !== conversationId);
      const newMap = new Map<string, Message>();
      itemsToKeep.forEach((item) => {
        newMap.set(item.tempId, item.message);
      });
      return {
        optimisticMessages: newMap,
        queue: itemsToKeep,
      };
    });
  },
}));
