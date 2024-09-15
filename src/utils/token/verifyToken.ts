import '../../config/env';
import jwt from 'jsonwebtoken';
import { verifyTokenError } from '../../errors/verifyTokenError';

export class verifyToken {
  // jwt.verify의 반환값 : 디코딩된 페이로드 or 오류
  static access(token: string) {
    try {
      return jwt.verify(token, process.env.ACCESS_SECRET_KEY!);
    } catch (err) {
      verifyTokenError(err);
    }
  }
  static refresh(token: string) {
    try {
      return jwt.verify(token, process.env.REFRESH_SECRET_KEY!);
    } catch (err) {
      verifyTokenError(err);
    }
  }
}
