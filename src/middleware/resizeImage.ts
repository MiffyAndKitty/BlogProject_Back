import '../config/env';
import { Request, Response, NextFunction } from 'express';
import sharp from 'sharp';
import { s3 } from '../config/s3';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { InternalServerError } from '../errors/internalServerError';
import { streamToBuffer } from '../utils/streamToBuffer';
import { Readable } from 'stream';
import { S3DirectoryName } from '../constants/s3/s3DirectoryName';

export const resizeImage = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.files?.length) return next();

      req.fileURL = [];

      const reqFiles = req.files as { [key: string]: any }[];

      for (const file of reqFiles) {
        // S3에서 파일을 가져온 후 리사이징
        const getObjectParams = {
          Bucket: file.bucket,
          Key: file.key
        };

        const s3File = await s3.send(new GetObjectCommand(getObjectParams));

        if (!s3File.Body) {
          console.error('S3 파일에서 Body를 찾을 수 없습니다.');
          return next(); // 사진 파일 없이 게시글 저장
        }

        const fileBuffer = await streamToBuffer(s3File.Body as Readable);

        const maxFileSize = 2 * 1024 * 1024;
        let quality = 80;

        const resizeImage = async (buffer: Buffer, quality: number) => {
          return await sharp(buffer)
            .resize({ width: 640 }) // 해상도 조정
            .jpeg({ quality }) // 초기 JPEG 품질 설정
            .toBuffer();
        };

        let resizedImage = await resizeImage(fileBuffer, quality);

        while (resizedImage.length > maxFileSize && quality > 10) {
          quality -= 10; // 품질을 10씩 낮춤
          resizedImage = await resizeImage(fileBuffer, quality);
        }

        // 리사이징된 파일을 S3에 업로드
        const uploadParams = {
          Bucket: process.env.S3_BUCKET,
          Key: `${S3DirectoryName.RESIZED_IMAGE}/${file.key}`,
          Body: resizedImage,
          ContentType: file.mimetype
        };

        await s3.send(new PutObjectCommand(uploadParams));

        // 리사이징된 파일의 URL을 생성하여 req.fileURL 배열에 추가
        const resizedFileURL = `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${S3DirectoryName.RESIZED_IMAGE}/${file.key}`;
        req.fileURL.push(resizedFileURL);

        // 원본 파일 삭제
        const deleteParams = {
          Bucket: file.bucket,
          Key: file.key
        };
        await s3.send(new DeleteObjectCommand(deleteParams));
      }
      next();
    } catch (err) {
      next(new InternalServerError('파일 처리 중 오류 발생'));
    }
  };
};
