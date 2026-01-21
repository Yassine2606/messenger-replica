import { View, Text, TouchableOpacity, ActivityIndicator, Image, Platform } from 'react-native';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useUploadImage } from '@/hooks';

interface AvatarUploaderProps {
  currentAvatarUrl?: string;
  userName: string;
  onAvatarChange: (url: string) => void;
  isLoading?: boolean;
}

export function AvatarUploader({
  currentAvatarUrl,
  userName,
  onAvatarChange,
  isLoading = false,
}: AvatarUploaderProps) {
  const [selectedImageUri, setSelectedImageUri] = useState<string | null>(null);
  const [uploadedAvatarUrl, setUploadedAvatarUrl] = useState<string>(currentAvatarUrl || '');
  const uploadImageMutation = useUploadImage();

  const getFullUrl = (url: string): string => {
    if (url.startsWith('http')) return url;
    // Remove /api prefix if the url doesn't start with /api
    const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
    // Remove /api from the end to get the base server URL
    const serverBaseUrl = baseUrl.replace('/api', '');
    return `${serverBaseUrl}${url}`;
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        setSelectedImageUri(imageUri);

        // Upload the image
        try {
          const uploadResult = await uploadImageMutation.mutateAsync(imageUri);
          if (uploadResult.success) {
            const fullUrl = getFullUrl(uploadResult.file.url);
            setUploadedAvatarUrl(fullUrl);
            onAvatarChange(fullUrl);
          }
        } catch (error) {
          console.error('Failed to upload image:', error);
        }
      }
    } catch (error) {
      console.error('Image picker error:', error);
    }
  };

  const displayUri = uploadedAvatarUrl || currentAvatarUrl || selectedImageUri;
  const showImage = displayUri && (displayUri.startsWith('http') || displayUri.startsWith('file'));
  const uploading = uploadImageMutation.isPending;

  // Convert file:// to proper iOS format if needed
  const getImageSource = () => {
    if (!displayUri) return undefined;

    // For iOS, handle file:// URIs properly
    if (Platform.OS === 'ios' && displayUri.startsWith('file://')) {
      return { uri: displayUri, cache: 'force-cache' as const };
    }

    return { uri: displayUri };
  };

  return (
    <View className="items-center">
      <View className="relative">
        <View
          className={`h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 ${
            uploading ? 'opacity-60' : ''
          }`}>
          {showImage ? (
            <Image
              source={getImageSource()}
              style={{ width: 96, height: 96, borderRadius: 48 }}
              resizeMode="cover"
            />
          ) : (
            <Text className="text-5xl font-bold text-white">
              {userName.charAt(0).toUpperCase()}
            </Text>
          )}
        </View>

        {/* Upload Button */}
        <TouchableOpacity
          onPress={handlePickImage}
          disabled={uploading || isLoading}
          className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-blue-500 shadow-md"
          activeOpacity={0.7}>
          {uploading ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Ionicons name="camera" size={16} color="#FFFFFF" />
          )}
        </TouchableOpacity>
      </View>

      <Text className="mt-3 text-xs font-medium text-gray-600">
        {uploading ? 'Uploading...' : 'Tap to change avatar'}
      </Text>
    </View>
  );
}
