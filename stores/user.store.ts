import { create } from 'zustand';

interface UserPresenceState {
  userId: number;
  lastSeen: string; // ISO timestamp
}

interface UserTypingState {
  typingUsers: Set<number>; // Set of user IDs currently typing
  userPresence: Map<number, UserPresenceState>; // Map of userId to presence state
  addTypingUser: (userId: number) => void;
  removeTypingUser: (userId: number) => void;
  setUserPresence: (userId: number, lastSeen: string) => void;
  getUserPresence: (userId: number) => UserPresenceState | undefined;
  isUserTyping: (userId: number) => boolean;
}

export const useUserStore = create<UserTypingState>((set, get) => ({
  typingUsers: new Set(),
  userPresence: new Map(),

  addTypingUser: (userId: number) => {
    set((state) => ({
      typingUsers: new Set(state.typingUsers).add(userId),
    }));
  },

  removeTypingUser: (userId: number) => {
    set((state) => {
      const newSet = new Set(state.typingUsers);
      newSet.delete(userId);
      return { typingUsers: newSet };
    });
  },

  setUserPresence: (userId: number, lastSeen: string) => {
    set((state) => {
      const newMap = new Map(state.userPresence);
      newMap.set(userId, { userId, lastSeen });
      return { userPresence: newMap };
    });
  },

  getUserPresence: (userId: number) => {
    return get().userPresence.get(userId);
  },

  isUserTyping: (userId: number) => {
    return get().typingUsers.has(userId);
  },
}));
