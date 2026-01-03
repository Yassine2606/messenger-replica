import { apiClient } from './client';

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
   * Upload a file (image or audio)
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
      }
      
      const formData = new FormData();
      
      // Append file to FormData - React Native format
      formData.append('file', {
        uri,
        name: filename,
        type: mimeType,
      } as any);
      
      formData.append('fileType', fileType);
      
      console.log('Uploading file:', { uri, filename, mimeType, fileType });
      
      // Use apiClient's post method
      const result = await apiClient.post<UploadResult>('/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      console.log('Upload result:', result);
      return result;
    } catch (error: any) {
      console.error('Upload service error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || error.message || 'Upload failed');
    }
  }
}

export const uploadService = new UploadService();
