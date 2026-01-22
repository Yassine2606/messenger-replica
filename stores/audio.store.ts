import { create } from 'zustand';

/**
 * Zustand Store: Audio Playback Controller
 * 
 * Purpose: Centralize audio playback state to prevent re-renders across components.
 * 
 * Why this matters:
 * - When ANY audio message is playing, we track the currently-playing ID here
 * - VoiceMessagePlayer components subscribe to ONLY this store (not message data)
 * - When a new audio starts playing, only the OLD and NEW player components re-render
 * - All OTHER messages stay in their memoized state (don't re-render)
 * 
 * Without this:
 * - New message arrives → Message store updates → ALL messages re-render → Lag
 * - Audio starts playing → Component state changes → Parent forces re-renders → Lag
 * 
 * With this:
 * - New message arrives → Message store updates → Chat screen updates cache only → No re-render of other bubbles
 * - Audio starts playing → Store updates → Only affected players re-render (memoized comparison skips others)
 */

interface AudioControllerState {
  // ID of currently playing audio message (null if nothing playing)
  currentlyPlayingMessageId: number | null;

  // Whether the user is currently recording (global indicator)
  isRecording: boolean;

  // Maps messageId -> playback progress (0-1)
  playbackProgress: Map<number, number>;

  // Maps messageId -> is loading
  isLoading: Map<number, boolean>;

  // Maps messageId -> error message (if any)
  errors: Map<number, string | null>;

  // Actions
  setCurrentlyPlaying: (messageId: number | null) => void;
  setIsRecording: (isRecording: boolean) => void;
  updateProgress: (messageId: number, progress: number) => void;
  setLoading: (messageId: number, isLoading: boolean) => void;
  setError: (messageId: number, error: string | null) => void;
  clearAll: () => void;
}

export const useAudioStore = create<AudioControllerState>((set) => ({
  currentlyPlayingMessageId: null,
  isRecording: false,
  playbackProgress: new Map(),
  isLoading: new Map(),
  errors: new Map(),

  setCurrentlyPlaying: (messageId) => {
    set(() => ({
      currentlyPlayingMessageId: messageId,
    }));
  },

  setIsRecording: (isRecording) => {
    set(() => ({ isRecording }));
  },

  updateProgress: (messageId, progress) => {
    set((state) => {
      const newProgress = new Map(state.playbackProgress);
      newProgress.set(messageId, progress);
      return { playbackProgress: newProgress };
    });
  },

  setLoading: (messageId, isLoading) => {
    set((state) => {
      const newLoading = new Map(state.isLoading);
      if (isLoading) {
        newLoading.set(messageId, true);
      } else {
        newLoading.delete(messageId);
      }
      return { isLoading: newLoading };
    });
  },

  setError: (messageId, error) => {
    set((state) => {
      const newErrors = new Map(state.errors);
      if (error) {
        newErrors.set(messageId, error);
      } else {
        newErrors.delete(messageId);
      }
      return { errors: newErrors };
    });
  },

  clearAll: () => {
    set(() => ({
      currentlyPlayingMessageId: null,
      isRecording: false,
      playbackProgress: new Map(),
      isLoading: new Map(),
      errors: new Map(),
    }));
  },
}));
