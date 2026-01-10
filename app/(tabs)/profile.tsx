import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useProfile, useLogout, useUpdateProfile } from '@/hooks';
import { CustomModal, FormField, Button, ProfileCard, AvatarUploader, UserAvatar } from '@/components/ui';

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { data: user, isLoading } = useProfile();
  const logoutMutation = useLogout();
  const updateProfileMutation = useUpdateProfile();
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [formData, setFormData] = useState({ name: '', status: '', avatarUrl: '' });

  const openEditModal = () => {
    if (user) {
      setFormData({ 
        name: user.name, 
        status: user.status || '',
        avatarUrl: user.avatarUrl || '',
      });
      setEditModalVisible(true);
    }
  };

  const handleUpdateProfile = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Validation Error', 'Name cannot be empty');
      return;
    }

    try {
      await updateProfileMutation.mutateAsync({
        name: formData.name,
        status: formData.status || undefined,
        avatarUrl: formData.avatarUrl || undefined,
      });
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
      console.error('Update profile error:', error);
    }
  };

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', onPress: () => {}, style: 'cancel' },
      {
        text: 'Logout',
        onPress: async () => {
          try {
            await logoutMutation.mutateAsync();
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
    <>
      <ScrollView
        className="flex-1 bg-gradient-to-b from-white to-gray-50"
        style={{ paddingTop: insets.top, paddingBottom: insets.bottom + 20 }}
        contentContainerStyle={{ flexGrow: 1 }}
        scrollEnabled={true}
        showsVerticalScrollIndicator={false}>
        <View className="px-6 py-8">
          {/* Header */}
          <View className="mb-8 flex-row items-end justify-between">
            <View className="flex-1">
              <Text className="text-3xl font-bold text-gray-900">Profile</Text>
              <Text className="mt-1 text-sm text-gray-600">Manage your account</Text>
            </View>
            <TouchableOpacity
              onPress={openEditModal}
              className="h-10 w-10 items-center justify-center rounded-full bg-blue-500 ml-4"
              activeOpacity={0.7}>
              <Ionicons name="pencil" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* Avatar Section */}
          <View className="mb-8 items-center">
            <View className="mb-4 shadow-lg">
              <UserAvatar avatarUrl={user.avatarUrl} userName={user.name} size="lg" />
            </View>
            <Text className="text-xl font-semibold text-gray-900">{user.name}</Text>
          </View>

          {/* Info Cards */}
          <View className="mb-8 gap-3">
            <ProfileCard icon="mail-outline" label="Email" value={user.email} />
            {user.status && (
              <ProfileCard icon="text-outline" label="Status" value={user.status} />
            )}
          </View>

          {/* Action Buttons */}
          <View className="gap-3 mt-auto">
            <Button
              label="Edit Profile"
              onPress={openEditModal}
              variant="secondary"
              icon="pencil"
            />
            <Button
              label={logoutMutation.isPending ? 'Logging out...' : 'Logout'}
              onPress={handleLogout}
              variant="destructive"
              loading={logoutMutation.isPending}
              icon="log-out"
            />
          </View>
        </View>
      </ScrollView>

      {/* Edit Modal */}
      <CustomModal
        visible={editModalVisible}
        title="Edit Profile"
        onClose={() => setEditModalVisible(false)}>
        <View className="pb-8">
          {/* Avatar Uploader */}
          <View className="mb-8">
            <AvatarUploader
              currentAvatarUrl={formData.avatarUrl}
              userName={formData.name || user?.name || 'User'}
              onAvatarChange={(url) => setFormData({ ...formData, avatarUrl: url })}
              isLoading={updateProfileMutation.isPending}
            />
          </View>

          {/* Form Fields */}
          <View className="gap-4 mb-6">
            <FormField
              label="Full Name"
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Enter your name"
              editable={!updateProfileMutation.isPending}
            />
            <FormField
              label="Status"
              value={formData.status}
              onChangeText={(text) => setFormData({ ...formData, status: text })}
              placeholder="e.g., Available, Busy, etc."
              editable={!updateProfileMutation.isPending}
              multiline
              maxLength={50}
            />
          </View>

          {/* Action Buttons */}
          <View className="gap-2">
            <Button
              label={updateProfileMutation.isPending ? 'Updating...' : 'Update Profile'}
              onPress={handleUpdateProfile}
              loading={updateProfileMutation.isPending}
            />
            <Button
              label="Cancel"
              onPress={() => setEditModalVisible(false)}
              variant="secondary"
              disabled={updateProfileMutation.isPending}
            />
          </View>
        </View>
      </CustomModal>
    </>
  );
}
