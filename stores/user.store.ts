import { create } from 'zustand';

/**
 * Zustand store for EPHEMERAL UI STATE ONLY
 * 
 * According to the Socket.io + React Query blueprint:
 * - Typing indicators: transient, don't persist
 * - User online/offline status: transient, don't persist
 * - Connection status: transient, don't persist
 * 
 * ❌ NOT stored here:
 * - Messages (React Query cache)
 * - Conversations (React Query cache)
 * - User profiles (React Query cache)
 * 
 * ✅ Stored here:
 * - Typing users (by conversation)
 * - User presence (online/offline, lastSeen)
 * - Socket connection status
 */

interface UserPresenceState {
  userId: number;
  status: 'online' | 'offline';
  lastSeen: string; // ISO timestamp
}

interface TypingIndicatorState {
  // Map of conversationId -> Set of typing userIds
  typingByConversation: Map<number, Set<number>>;
}

interface UserEphemeralState extends TypingIndicatorState {
  // User presence tracking (online/offline/lastSeen)
  userPresence: Map<number, UserPresenceState>;
  socketConnected: boolean;

  // Typing indicator actions
  addTypingUser: (conversationId: number, userId: number) => void;
  removeTypingUser: (conversationId: number, userId: number) => void;
  getTypingUsers: (conversationId: number) => number[];
  isUserTyping: (conversationId: number, userId: number) => boolean;

  // User status actions
  setUserStatus: (userId: number, status: 'online' | 'offline', lastSeen: string) => void;
  getUserStatus: (userId: number) => UserPresenceState | undefined;

  // Socket connection status
  setSocketConnected: (connected: boolean) => void;
  isSocketConnected: () => boolean;
}

export const useUserStore = create<UserEphemeralState>((set, get) => ({
  typingByConversation: new Map(),
  userPresence: new Map(),
  socketConnected: false,

  /**
   * Add typing user to a conversation
   */
  addTypingUser: (conversationId: number, userId: number) => {
    set((state) => {
      const newMap = new Map(state.typingByConversation);
      const typingSet = newMap.get(conversationId) || new Set();
      typingSet.add(userId);
      newMap.set(conversationId, typingSet);
      return { typingByConversation: newMap };
    });
  },

  /**
   * Remove typing user from a conversation
   */
  removeTypingUser: (conversationId: number, userId: number) => {
    set((state) => {
      const newMap = new Map(state.typingByConversation);
      const typingSet = newMap.get(conversationId);
      if (typingSet) {
        typingSet.delete(userId);
        if (typingSet.size === 0) {
          newMap.delete(conversationId);
        } else {
          newMap.set(conversationId, typingSet);
        }
      }
      return { typingByConversation: newMap };
    });
  },

  /**
   * Get all typing users in a conversation
   */
  getTypingUsers: (conversationId: number) => {
    const typingSet = get().typingByConversation.get(conversationId);
    return typingSet ? Array.from(typingSet) : [];
  },

  /**
   * Check if a specific user is typing in a conversation
   */
  isUserTyping: (conversationId: number, userId: number) => {
    const typingSet = get().typingByConversation.get(conversationId);
    return typingSet ? typingSet.has(userId) : false;
  },

  /**
   * Update user status (online/offline) with lastSeen timestamp
   * Called when receiving user:status events from Socket.io
   */
  setUserStatus: (userId: number, status: 'online' | 'offline', lastSeen: string) => {
    set((state) => {
      const newMap = new Map(state.userPresence);
      newMap.set(userId, { userId, status, lastSeen });
      return { userPresence: newMap };
    });
  },

  /**
   * Get user presence info
   */
  getUserStatus: (userId: number) => {
    return get().userPresence.get(userId);
  },

  /**
   * Update socket connection status
   */
  setSocketConnected: (connected: boolean) => {
    set({ socketConnected: connected });
  },

  /**
   * Check if socket is connected
   */
  isSocketConnected: () => {
    return get().socketConnected;
  },
}));
