import { useUserStore } from '@/stores';

/**
 * Hook to get real-time user presence data
 * Returns the most up-to-date lastSeen timestamp from the store
 * Falls back to provided lastSeen if store doesn't have it or userId is not provided
 */
export function useUserPresence(userId: number | undefined, fallbackLastSeen?: string) {
  // Use Zustand selector to get stable reference to presence data
  // If userId is not provided, return the fallback lastSeen
  const lastSeen = useUserStore(
    (state) => (userId ? state.userPresence.get(userId)?.lastSeen || fallbackLastSeen : fallbackLastSeen)
  );

  return lastSeen;
}
