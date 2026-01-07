import { useMutation } from '@tanstack/react-query';
import { uploadService, type UploadResult, type FileType } from '@/services';

/**
 * Hook to upload a file (image or audio)
 */
export function useUploadFile() {
  return useMutation({
    mutationFn: async ({ uri, fileType }: { uri: string; fileType: FileType }) => {
      return uploadService.uploadFile(uri, fileType);
    },
  });
}

/**
 * Hook specifically for uploading images
 */
export function useUploadImage() {
  return useMutation({
    mutationFn: async (uri: string) => {
      return uploadService.uploadFile(uri, 'image');
    },
  });
}

/**
 * Hook specifically for uploading audio
 */
export function useUploadAudio() {
  return useMutation({
    mutationFn: async (uri: string) => {
      return uploadService.uploadFile(uri, 'audio');
    },
  });
}
