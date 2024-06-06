import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { verifyTokenError } from '../../errors/verifyTokenError';
export class verifyToken {
  // jwt.verify의 반환값 : 디코딩된 페이로드 or 오류
  static access(token: string): object | jwt.JwtPayload | string {
    try {
      return jwt.verify(token, process.env.ACCESS_SECRET_KEY!);
    } catch (err) {
      const error = verifyTokenError(err);
      console.log('access토큰 유효성 검증 오류 : ', error.message);
      return { result: false, message: error.message };
    }
  }
  static refresh(token: string): object | jwt.JwtPayload | string {
    try {
      return jwt.verify(token, process.env.REFRESH_SECRET_KEY!);
    } catch (err) {
      const error = verifyTokenError(err);
      console.log('refresh 토큰 유효성 검증 오류 : ', error.message);
      return { result: false, message: error.message };
    }
  }
}
