import * as FileSystemLegacy from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
   * Upload a file (image or audio) using fetch API
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
      console.log('File info:', { uri, exists: fileInfo.exists, size: fileInfo.size });
      
      if (!fileInfo.exists) {
        throw new Error(`File not found: ${uri}`);
      }
      
      // Read file as base64
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      
      // Create FormData with blob
      const formData = new FormData();
      
      // Create a Blob from base64 data
      const blob = await fetch(`data:${mimeType};base64,${base64Data}`).then((res) =>
        res.blob()
      );
      
      formData.append('file', blob, filename);
      formData.append('fileType', fileType);
      
      // Get auth token
      const token = await AsyncStorage.getItem('auth_token');
      
      const apiUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000/api';
      
      console.log('Uploading file via fetch:', { filename, mimeType, fileType, size: fileInfo.size });
      
      const response = await fetch(`${apiUrl}/upload`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });
      
      console.log('Upload response status:', response.status, response.statusText);
      
      const responseText = await response.text();
      console.log('Upload response body:', responseText);
      
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
      console.log('Upload result:', result);
      return result;
    } catch (error: any) {
      console.error('Upload service error:', {
        message: error.message,
        stack: error.stack,
      });
      throw new Error(error.message || 'Upload failed');
    }
  }
}

export const uploadService = new UploadService();
