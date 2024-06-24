import 'dotenv/config';
import { s3 } from '../config/s3';
import multer from 'multer';
import multerS3 from 'multer-s3';

export const upload = (folder: string) =>
  multer({
    storage: multerS3({
      s3,
      bucket: process.env.S3_BUCKET!,
      contentType: multerS3.AUTO_CONTENT_TYPE,
      key(req, file, cb) {
        const extention = file.mimetype.split('/')[1];
        if (!['png', 'jpg', 'jpeg', 'gif'].includes(extention)) {
          return cb(new Error('이미지 파일을 등록해주세요.'));
        }
        cb(null, `${folder}/${file.originalname}_${Date.now()}`);
      }
    }),
    limits: { fileSize: 5 * 1024 * 1024 } // 용량 제한: 5MB
  });
