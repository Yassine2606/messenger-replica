import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

/**
 * Request and launch image library picker
 * @returns The selected image URI or null if cancelled
 */
export async function pickImageFromLibrary(): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant photo library access to send images');
      return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.error('Image picker error:', error);
    Alert.alert('Error', error?.message || 'Failed to pick image');
    return null;
  }
}

/**
 * Request camera permission and launch camera to take photo
 * @returns The taken photo URI or null if cancelled
 */
export async function takePhotoWithCamera(): Promise<string | null> {
  try {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission required', 'Please grant camera access to take photos');
      return null;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      return result.assets[0].uri;
    }
    return null;
  } catch (error: any) {
    console.error('Camera error:', error);
    Alert.alert('Error', error?.message || 'Failed to take photo');
    return null;
  }
}
