import '../global.css';

import { Stack } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalProvider } from '@gorhom/portal';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AuthProvider, SocketProvider } from '@/contexts';
import { useSocketEventListener } from '@/hooks';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Data is kept fresh via socket invalidation
      retry: 1,
      refetchOnWindowFocus: true,
    },
    mutations: {
      retry: 0,
    },
  },
});

function RootNavigator() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

function AppContent() {
  // Set up socket event listeners at root level
  useSocketEventListener();

  return <RootNavigator />;
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SocketProvider>
                <BottomSheetModalProvider>
                  <PortalProvider>
                    <AppContent />
                  </PortalProvider>
                </BottomSheetModalProvider>
              </SocketProvider>
            </AuthProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
