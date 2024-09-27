import '../config/env';
import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import {
  deleteOriginalFile,
  getFileFromS3,
  uploadResizedImage
} from '../utils/s3';
import { InternalServerError } from '../errors/internalServerError';
import {
  INITIAL_QUALITY,
  MAX_FILE_SIZE,
  MIN_QUALITY,
  QUALITY_DECREMENT,
  RESIZED_IMAGE_WIDTH
} from '../constants/file';
import { S3File } from '../interfaces/uploadedFile';

export const resizeImage = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0)
        return next();

      const resizedFileUrls: string[] = [];

      const originalFiles = req.files as S3File[];

      await Promise.all(
        originalFiles.map(async (file) => {
          const fileBuffer = await getFileFromS3(file);

          let quality = INITIAL_QUALITY;

          const resizeImageBuffer = async (
            buffer: Buffer,
            quality: number
          ): Promise<Buffer> => {
            return sharp(buffer)
              .resize({
                width: RESIZED_IMAGE_WIDTH,
                withoutEnlargement: true // 원본보다 큰 이미지로 확대를 방지
              })
              .jpeg({ quality })
              .toBuffer();
          };

          let resizedImage = await resizeImageBuffer(fileBuffer, quality);

          while (resizedImage.length > MAX_FILE_SIZE && quality > MIN_QUALITY) {
            quality -= QUALITY_DECREMENT;
            resizedImage = await resizeImageBuffer(fileBuffer, quality);
          }

          const resizedFileURL = await uploadResizedImage(file, resizedImage);
          resizedFileUrls.push(resizedFileURL);

          await deleteOriginalFile(file);
        })
      );
      req.fileURL = resizedFileUrls;
      next();
    } catch (err) {
      next(new InternalServerError('파일 처리 중 오류 발생'));
    }
  };
};
