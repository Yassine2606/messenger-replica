import * as MediaLibrary from 'expo-media-library';
import { Alert, Platform } from 'react-native';

/**
 * Convert media library asset URI to usable file path
 * iOS returns ph:// URLs that need to be resolved to actual file paths
 */
export async function getAssetFileUri(asset: MediaLibrary.Asset): Promise<string> {
  if (Platform.OS === 'ios') {
    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset);
      return info.localUri || asset.uri;
    } catch (error) {
      console.warn('Failed to get asset info, using original URI:', error);
      return asset.uri;
    }
  }
  return asset.uri;
}

/**
 * Request media library permissions
 * Uses getPermissionsAsync first, then requestPermissionsAsync if needed
 * Falls back gracefully on Expo Go (Android)
 */
export async function requestMediaLibraryPermission(): Promise<boolean> {
  try {
    // Check current permission status first
    const { status: currentStatus } = await MediaLibrary.getPermissionsAsync(
      false, // writeOnly
      ['photo'] // Only request photo permission
    );

    if (currentStatus === 'granted') {
      return true;
    }

    // Request permission if not already granted
    const { status } = await MediaLibrary.requestPermissionsAsync(
      false, // writeOnly
      ['photo'] // Only request photo permission
    );

    return status === 'granted';
  } catch (error: any) {
    // On Android Expo Go, media-library is not fully supported
    // Return false to allow fallback to image-picker
    console.warn('Media library not fully supported in this environment:', error?.message);
    return false;
  }
}

/**
 * Request media library permissions and get first batch of assets
 */
export async function requestMediaLibraryPermissionAndGetAssets() {
  try {
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) {
      Alert.alert('Permission required', 'Please grant media library access to send images');
      return null;
    }

    const albums = await MediaLibrary.getAlbumsAsync({
      includeSmartAlbums: true,
    });

    if (!albums || albums.length === 0) {
      return null;
    }

    // Get assets from the most recent album (usually "Camera Roll" or "All Photos")
    const targetAlbum = albums[0];
    const assets = await MediaLibrary.getAssetsAsync({
      first: 50,
      mediaType: 'photo',
      sortBy: [MediaLibrary.SortBy.modificationTime],
      album: targetAlbum,
    });

    return assets;
  } catch (error: any) {
    console.error('Media library error:', error?.message || error);
    Alert.alert('Error', 'Failed to access media library');
    return null;
  }
}

/**
 * Get more assets from media library with pagination
 */
export async function getMoreMediaAssets(endCursor: string | null) {
  try {
    if (!endCursor) return null;

    // Ensure permission is granted
    const hasPermission = await requestMediaLibraryPermission();
    if (!hasPermission) return null;

    const albums = await MediaLibrary.getAlbumsAsync({
      includeSmartAlbums: true,
    });

    if (!albums || albums.length === 0) {
      return null;
    }

    const targetAlbum = albums[0];
    const assets = await MediaLibrary.getAssetsAsync({
      first: 50,
      after: endCursor,
      mediaType: 'photo',
      sortBy: [MediaLibrary.SortBy.modificationTime],
      album: targetAlbum,
    });

    return assets;
  } catch (error: any) {
    console.error('Media pagination error:', error);
    return null;
  }
}
