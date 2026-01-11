import React, { useEffect, useState } from 'react';
import { View, FlatList, Image, Pressable, ActivityIndicator, Alert, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { requestMediaLibraryPermissionAndGetAssets, getMoreMediaAssets, getAssetFileUri } from '@/lib/media-library';
import { pickImageFromLibrary } from '@/lib/image-picker';

interface ImageMediaPickerProps {
  onImageSelected: (uri: string) => void;
  onClose: () => void;
}

interface MediaAsset {
  id: string;
  uri: string;
  width: number;
  height: number;
}

/**
 * ImageMediaPicker: Bottom sheet style image picker from media library
 * Shows recent photos in a grid with pagination support
 * Perfect for messenger-style integration
 */
export function ImageMediaPicker({ onImageSelected, onClose }: ImageMediaPickerProps) {
  const [assets, setAssets] = useState<MediaAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // Load initial assets
  useEffect(() => {
    const loadAssets = async () => {
      try {
        const result = await requestMediaLibraryPermissionAndGetAssets();
        if (result) {
          const mappedAssets = result.assets.map((asset) => ({
            id: asset.id,
            uri: asset.uri,
            width: asset.width || 0,
            height: asset.height || 0,
          }));
          setAssets(mappedAssets);
          setEndCursor(result.endCursor);
          setHasMore(result.hasNextPage);
        } else {
          // Fallback to simple image picker if media library is not available (e.g., Expo Go on Android)
          console.log('Media library not available, falling back to image picker');
          const uri = await pickImageFromLibrary();
          if (uri) {
            onImageSelected(uri);
            onClose();
          }
        }
      } catch (error) {
        console.error('Failed to load media assets:', error);
        // Fallback to simple picker on error
        const uri = await pickImageFromLibrary();
        if (uri) {
          onImageSelected(uri);
          onClose();
        }
      } finally {
        setLoading(false);
      }
    };

    loadAssets();
  }, [onImageSelected, onClose]);

  // Load more assets
  const handleLoadMore = async () => {
    if (!hasMore || !endCursor) return;

    try {
      const result = await getMoreMediaAssets(endCursor);
      if (result) {
        const mappedAssets = result.assets.map((asset) => ({
          id: asset.id,
          uri: asset.uri,
          width: asset.width || 0,
          height: asset.height || 0,
        }));
        setAssets((prev) => [...prev, ...mappedAssets]);
        setEndCursor(result.endCursor);
        setHasMore(result.hasNextPage);
      }
    } catch (error) {
      console.error('Failed to load more assets:', error);
    }
  };

  const handleSelectImage = async (asset: MediaAsset) => {
    try {
      // Get the actual file URI (important for iOS where ph:// URLs are returned)
      const fileUri = await getAssetFileUri({
        id: asset.id,
        uri: asset.uri,
        mediaType: 'photo' as const,
        width: asset.width,
        height: asset.height,
        creationTime: 0,
        modificationTime: 0,
      } as MediaLibrary.Asset);
      
      onImageSelected(fileUri);
      onClose();
    } catch (error) {
      Alert.alert('Error', 'Failed to select image');
    }
  };

  const renderAsset = ({ item }: { item: MediaAsset }) => (
    <Pressable
      onPress={() => handleSelectImage(item)}
      className="flex-1 m-1 rounded-lg overflow-hidden active:opacity-70"
      style={{ aspectRatio: 1 }}>
      <Image source={{ uri: item.uri }} className="flex-1" />
    </Pressable>
  );

  const renderFooter = () => {
    if (!hasMore) return null;
    return (
      <View className="items-center justify-center py-4">
        <ActivityIndicator size="small" color="#3B82F6" />
      </View>
    );
  };

  if (loading) {
    return (
      <View className="bg-white rounded-t-2xl p-4 items-center justify-center h-64">
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    );
  }

  return (
    <View className="bg-white max-h-80 flex-1">
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
        <Text className="text-lg font-semibold text-gray-900">Recent Photos</Text>
        <Pressable
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          className="active:opacity-70">
          <Ionicons name="close" size={24} color="#6B7280" />
        </Pressable>
      </View>

      {/* Grid */}
      <FlatList
        data={assets}
        renderItem={renderAsset}
        keyExtractor={(item) => item.id}
        numColumns={3}
        scrollEnabled
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View className="flex-1 items-center justify-center py-8">
            <Ionicons name="image-outline" size={48} color="#D1D5DB" />
          </View>
        }
      />
    </View>
  );
}
