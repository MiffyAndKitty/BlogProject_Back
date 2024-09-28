import '../config/env';
import { s3 } from '../config/s3';
import multer from 'multer';
import multerS3 from 'multer-s3';
import { BadRequestError } from '../errors/badRequestError';
import {
  ALLOWED_EXTENSIONS,
  UPLOAD_FIELD_SIZE_LIMIT,
  UPLOAD_FILE_SIZE_LIMIT
} from '../constants/file';

export const upload = (folder: string) =>
  multer({
    storage: multerS3({
      s3,
      bucket: process.env.S3_BUCKET!,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key(req, file, cb) {
        const extention = file.mimetype.split('/')[1];
        if (!ALLOWED_EXTENSIONS.includes(extention)) {
          return cb(
            new BadRequestError(
              `${ALLOWED_EXTENSIONS} 확장자에 맞는 이미지 파일을 등록해주세요.`
            )
          );
        }
        cb(null, `${folder}/${file.originalname}_${Date.now()}`);
      }
    }),
    limits: {
      fileSize: UPLOAD_FILE_SIZE_LIMIT,
      fieldSize: UPLOAD_FIELD_SIZE_LIMIT
    }
  });
