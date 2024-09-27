import { s3 } from '../config/s3';
import {
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand
} from '@aws-sdk/client-s3';
import { S3File } from '../interfaces/uploadedFile';
import { InternalServerError } from '../errors/internalServerError';
import { streamToBuffer } from './streamToBuffer';
import { Readable } from 'stream';
import { S3DirectoryName } from '../constants/s3DirectoryName';
import { ensureError } from '../errors/ensureError';

export const getFileFromS3 = async (file: S3File): Promise<Buffer> => {
  try {
    const getObjectParams = {
      Bucket: file.bucket,
      Key: file.key
    };

    const s3File = await s3.send(new GetObjectCommand(getObjectParams));

    if (!s3File.Body) {
      throw new InternalServerError('S3 파일에서 Body를 찾을 수 없습니다.');
    }

    return await streamToBuffer(s3File.Body as Readable);
  } catch (err) {
    throw ensureError(err, 'S3 파일 가져오기 오류');
  }
};

export const uploadResizedImage = async (
  file: S3File,
  resizedImage: Buffer
): Promise<string> => {
  try {
    const uploadParams = {
      Bucket: process.env.S3_BUCKET,
      Key: `${S3DirectoryName.RESIZED_IMAGE}/${file.key}`,
      Body: resizedImage,
      ContentType: file.mimetype
    };

    await s3.send(new PutObjectCommand(uploadParams));

    return `https://${process.env.S3_BUCKET}.s3.${process.env.S3_REGION}.amazonaws.com/${S3DirectoryName.RESIZED_IMAGE}/${file.key}`;
  } catch (err) {
    throw ensureError(err, '리사이즈된 이미지 업로드 오류');
  }
};

export const deleteOriginalFile = async (file: S3File): Promise<void> => {
  try {
    const deleteParams = {
      Bucket: file.bucket,
      Key: file.key
    };
    await s3.send(new DeleteObjectCommand(deleteParams));
  } catch (err) {
    throw ensureError(err, '원본 파일 삭제 오류');
  }
};
