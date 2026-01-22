import '../global.css';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PortalProvider } from '@gorhom/portal';
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { configureReanimatedLogger, ReanimatedLogLevel } from 'react-native-reanimated';
import { SocketProvider, ThemeProvider, useTheme } from '@/contexts';
import { useSocketEventListener } from '@/hooks';

// Configure Reanimated logger - disable strict mode
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity, // Data is kept fresh via socket invalidation
      retry: 1,
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
    </Stack>
  );
}

function AppContent() {
  // Set up socket event listeners at root level
  useSocketEventListener();
  const { theme } = useTheme();

  // StatusBar style needs to be inverted on iOS due to platform differences
  const statusBarStyle = Platform.OS === 'ios'
    ? (theme === 'dark' ? 'light' : 'dark')
    : (theme === 'dark' ? 'light' : 'dark');

  return (
    <>
      <StatusBar style={statusBarStyle} />
      <RootNavigator />
    </>
  );
}

export default function Layout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider>
              <SocketProvider>
                <BottomSheetModalProvider>
                  <PortalProvider>
                    <AppContent />
                  </PortalProvider>
                </BottomSheetModalProvider>
              </SocketProvider>
            </ThemeProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
