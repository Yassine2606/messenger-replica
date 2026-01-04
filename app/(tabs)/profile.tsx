import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useProfile, useLogout } from '@/hooks/useAuth';
import { useAuth } from '@/contexts/AuthContext';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: user, isLoading } = useProfile();
  const { logout: authLogout } = useAuth();
  const logoutMutation = useLogout();

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await logoutMutation.mutateAsync();
            authLogout(); // Clear auth state
            router.replace('/auth/login' as any);
          } catch (error) {
            Alert.alert('Error', 'Failed to logout. Please try again.');
            console.error('Logout error:', error);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  if (!user) {
    return (
      <View
        className="flex-1 bg-white"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View className="flex-1 items-center justify-center px-6">
          <Text className="text-xl font-semibold text-gray-900">No user data</Text>
          <Text className="mt-2 text-center text-base text-gray-600">
            Please login again.
          </Text>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => router.replace('/auth/login' as any)}
            className="mt-6 rounded-lg bg-blue-600 px-6 py-3">
            <Text className="font-semibold text-white">Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <ScrollView
      className="flex-1 bg-white"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      contentContainerClassName="px-6 py-8">
      <Text className="mb-6 text-2xl font-bold text-gray-900">Profile</Text>

      <View className="mb-6 rounded-lg border border-gray-200 bg-gray-50 p-4">
        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-500">Name</Text>
          <Text className="mt-1 text-base text-gray-900">{user.name}</Text>
        </View>

        <View className="mb-3">
          <Text className="text-sm font-medium text-gray-500">Email</Text>
          <Text className="mt-1 text-base text-gray-900">{user.email}</Text>
        </View>

        {user.status && (
          <View>
            <Text className="text-sm font-medium text-gray-500">Status</Text>
            <Text className="mt-1 text-base text-gray-900">{user.status}</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={handleLogout}
        disabled={logoutMutation.isPending}
        className="rounded-lg bg-red-600 py-4">
        <Text className="text-center text-base font-semibold text-white">
          {logoutMutation.isPending ? 'Logging out...' : 'Logout'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}
