import { useEffect, useState } from 'react';
import { Redirect } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';

export default function Index() {
  const { isAuthenticated, isLoading } = useAuth();
  const [isReady, setIsReady] = useState(false);

  // Wait for auth to initialize and add small delay for Android
  useEffect(() => {
    if (!isLoading) {
      // Small delay to ensure Android has processed auth state
      const timer = setTimeout(() => {
        setIsReady(true);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading]);

  // Show nothing while loading or waiting
  if (!isReady) {
    return null;
  }

  // Route based on actual auth state
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/auth/login" />;
}
