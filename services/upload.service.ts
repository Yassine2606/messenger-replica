import * as FileSystemLegacy from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export interface UploadResult {
  success: boolean;
  file: {
    url: string;
    filename: string;
    mimeType: string;
    size: number;
  };
}

export type FileType = 'image' | 'audio';

export class UploadService {
  /**
   * Upload a file (image or audio) using fetch API with proper multipart/form-data
   */
  async uploadFile(uri: string, fileType: FileType): Promise<UploadResult> {
    try {
      // Extract filename from URI
      const filename = uri.split('/').pop() || 'file';

      // Determine mime type based on file extension
      const extension = filename.split('.').pop()?.toLowerCase();
      let mimeType = 'application/octet-stream';

      if (fileType === 'image') {
        if (extension === 'jpg' || extension === 'jpeg') mimeType = 'image/jpeg';
        else if (extension === 'png') mimeType = 'image/png';
        else if (extension === 'gif') mimeType = 'image/gif';
        else if (extension === 'webp') mimeType = 'image/webp';
      } else if (fileType === 'audio') {
        if (extension === 'mp3') mimeType = 'audio/mpeg';
        else if (extension === 'wav') mimeType = 'audio/wav';
        else if (extension === 'ogg') mimeType = 'audio/ogg';
        else if (extension === 'm4a') mimeType = 'audio/m4a';
        else if (extension === 'aac') mimeType = 'audio/aac';
      }

      // Get file info from filesystem using legacy API
      const FileSystem = FileSystemLegacy as any;
      const fileInfo = await FileSystem.getInfoAsync(uri);

      if (!fileInfo.exists) {
        throw new Error(`File not found: ${uri}`);
      }

      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No auth token found');
      }

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
      const uploadUrl = `${apiUrl}/upload`;

      // Create FormData manually for React Native compatibility
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: mimeType,
        name: filename,
      } as any);
      formData.append('fileType', fileType);

      // Fetch with timeout (30 seconds for large file uploads)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Use URI-based FormData for both iOS and Android
      // React Native's FormData handles file:// URIs natively
      console.log('Upload using URI-based FormData, mimeType:', mimeType);
      const requestBody = formData;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseText = await response.text();
      console.log('Upload response:', response.status, responseText);

      if (!response.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { message: responseText };
        }
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const result = JSON.parse(responseText);
      console.log('Upload successful, file URL:', result.file?.url);
      return result;
    } catch (error: any) {
      console.error('Upload service error:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack,
      });
      throw new Error(error.message || 'Upload failed');
    }
  }
}

export const uploadService = new UploadService();
