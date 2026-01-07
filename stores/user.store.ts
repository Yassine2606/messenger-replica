import { create } from 'zustand';

interface UserTypingState {
  typingUsers: Set<number>; // Set of user IDs currently typing
  onlineUsers: Set<number>; // Set of user IDs currently online
  addTypingUser: (userId: number) => void;
  removeTypingUser: (userId: number) => void;
  setOnlineUsers: (userIds: number[]) => void;
  addOnlineUser: (userId: number) => void;
  removeOnlineUser: (userId: number) => void;
  isUserTyping: (userId: number) => boolean;
  isUserOnline: (userId: number) => boolean;
}

export const useUserStore = create<UserTypingState>((set, get) => ({
  typingUsers: new Set(),
  onlineUsers: new Set(),

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

  setOnlineUsers: (userIds: number[]) => {
    set({ onlineUsers: new Set(userIds) });
  },

  addOnlineUser: (userId: number) => {
    set((state) => ({
      onlineUsers: new Set(state.onlineUsers).add(userId),
    }));
  },

  removeOnlineUser: (userId: number) => {
    set((state) => {
      const newSet = new Set(state.onlineUsers);
      newSet.delete(userId);
      return { onlineUsers: newSet };
    });
  },

  isUserTyping: (userId: number) => {
    return get().typingUsers.has(userId);
  },

  isUserOnline: (userId: number) => {
    return get().onlineUsers.has(userId);
  },
}));
