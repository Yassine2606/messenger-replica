import { Request, Response, NextFunction } from 'express';
import { fileStorage, FileType } from '../lib/file-storage';
import { AppError } from '../middleware';

export class UploadController {
  async uploadFile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log('Upload request received:', {
        file: req.file ? 'present' : 'missing',
        fileType: req.body.fileType,
        body: req.body,
      });

      if (!req.file) {
        throw new AppError(400, 'No file uploaded');
      }

      const fileType = req.body.fileType as FileType;
      if (!fileType || !['image', 'audio'].includes(fileType)) {
        throw new AppError(400, 'Invalid file type. Must be "image" or "audio"');
      }

      const result = await fileStorage.saveFile(
        req.file.buffer,
        req.file.mimetype,
        fileType
      );

      res.status(200).json({
        success: true,
        file: {
          url: result.url,
          filename: result.filename,
          mimeType: result.mimeType,
          size: result.size,
        },
      });
    } catch (error) {
      next(error);
    }
  }
}

export const uploadController = new UploadController();
