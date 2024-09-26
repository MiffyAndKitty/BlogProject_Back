import '../config/env';
import { s3 } from '../config/s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { BadRequestError } from '../errors/badRequestError';

export const upload = (folder: string) =>
  multer({
    storage: multerS3({
      s3,
      bucket: process.env.S3_BUCKET!,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key(req, file, cb) {
        const extention = file.mimetype.split('/')[1];
        if (!['png', 'jpg', 'jpeg', 'gif'].includes(extention)) {
          return cb(
            new BadRequestError(
              "'png', 'jpg', 'jpeg', 'gif' 확장자에 맞는 이미지 파일을 등록해주세요."
            )
          );
        }
        cb(null, `${folder}/${file.originalname}_${Date.now()}`);
      }
    }),
    limits: {
      fileSize: 20 * 1024 * 1024, // 파일 사이즈 용량 제한: 20MB
      files: 10, //  파일 필드 최대 갯수 :10개
      fieldSize: 2 * 1024 * 1024 // 필드값 제한 : 2MB (기본 1MB)
    }
  });
