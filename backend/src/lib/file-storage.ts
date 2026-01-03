import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { AppError } from '../middleware';

export type FileType = 'image' | 'audio';

export interface FileUploadResult {
  filename: string;
  url: string;
  mimeType: string;
  size: number;
  duration?: number;
}

class FileStorage {
  private uploadDir: string = path.join(process.cwd(), 'uploads');

  constructor() {
    // Storage implementation for local file system only
  }

  /**
   * Validate file before upload
   */
  public validateFile(
    buffer: Buffer,
    mimeType: string,
    fileType: FileType
  ): { valid: boolean; error?: string } {
    const imageMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    const audioMimeTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    const imageSizeLimit = 10 * 1024 * 1024; // 10MB
    const audioSizeLimit = 50 * 1024 * 1024; // 50MB

    const allowedTypes = fileType === 'image' ? imageMimeTypes : audioMimeTypes;
    const maxSize = fileType === 'image' ? imageSizeLimit : audioSizeLimit;

    if (!allowedTypes.includes(mimeType)) {
      return {
        valid: false,
        error: `Invalid ${fileType} type. Allowed: ${allowedTypes.join(', ')}`,
      };
    }

    if (buffer.length > maxSize) {
      const maxMB = (maxSize / 1024 / 1024).toFixed(2);
      return {
        valid: false,
        error: `File size exceeds maximum of ${maxMB}MB`,
      };
    }

    return { valid: true };
  }

  /**
   * Save file and return URL
   */
  public async saveFile(buffer: Buffer, mimeType: string, fileType: FileType): Promise<FileUploadResult> {
    const validation = this.validateFile(buffer, mimeType, fileType);
    if (!validation.valid) {
      throw new AppError(400, validation.error || 'Invalid file');
    }

    const filename = `${fileType}-${crypto.randomBytes(16).toString('hex')}-${Date.now()}`;
    const filepath = path.join(this.uploadDir, filename);

    try {
      await fs.mkdir(this.uploadDir, { recursive: true });
      await fs.writeFile(filepath, buffer);

      return {
        filename,
        url: `/uploads/${filename}`,
        mimeType,
        size: buffer.length,
      };
    } catch (error) {
      throw new AppError(500, 'Failed to save file');
    }
  }

  /**
   * Delete file
   */
  public async deleteFile(filename: string): Promise<void> {
    try {
      const filepath = path.join(this.uploadDir, filename);
      await fs.unlink(filepath);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  }
}

export const fileStorage = new FileStorage();