import 'dotenv/config';
import jwt from 'jsonwebtoken';

export class verifyToken {
  // jwt.verify의 반환값 : 디코딩된 페이로드 or 오류
  static access(token: string): object | jwt.JwtPayload | string {
    try {
      return jwt.verify(token, process.env.ACCESS_SECRET_KEY!);
    } catch (err: unknown) {
      const ERROR = err instanceof Error;
      if (ERROR && err.name === 'TokenExpiredError') {
        return { result: false, message: '만료된 access 토큰' };
      } else if (ERROR && err.name === 'JsonWebTokenError') {
        return { result: false, message: '유효하지 않은 access 토큰' };
      } else if (ERROR && err.name === 'TypeError') {
        return { result: false, message: '잘못된 타입의 access 토큰' };
      }
      return { result: false, message: 'access 토큰 검증 오류' };
    }
  }
  static refresh(token: string): object | jwt.JwtPayload | string {
    try {
      return jwt.verify(token, process.env.REFRESH_SECRET_KEY!);
    } catch (err: unknown) {
      const ERROR = err instanceof Error;
      if (ERROR && err.name === 'TokenExpiredError') {
        return { result: false, message: '만료된 refresh 토큰' };
      } else if (ERROR && err.name === 'JsonWebTokenError') {
        return { result: false, message: '유효하지 않은 refresh 토큰' };
      } else if (ERROR && err.name === 'TypeError') {
        return { result: false, message: '잘못된 타입의 refresh 토큰' };
      }
      return { result: false, message: 'refresh 토큰 검증 오류' };
    }
  }
}
