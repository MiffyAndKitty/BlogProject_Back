import 'dotenv/config';
import jwt from 'jsonwebtoken';

export class newToken {
  static access(userId: string) {
    // access토큰 발급
    try {
      return jwt.sign({ id: userId }, process.env.ACCESS_SECRET_KEY!, {
        algorithm: 'HS512', // SHA512 암호화 알고리즘
        expiresIn: '1h' // 유효기간
      });
    } catch (err) {
      if (err instanceof Error) {
        return { result: false, message: err.name };
      }
      return { result: false, message: 'access 토큰 발급 오류' };
    }
  }
  static refresh() {
    try {
      return jwt.sign({}, process.env.REFRESH_SECRET_KEY!, {
        algorithm: 'HS512', // SHA512
        expiresIn: '7d'
      });
    } catch (err) {
      if (err instanceof Error) {
        return { result: false, message: err.name };
      }
      return { result: false, message: 'refresh 토큰 발급 오류' };
    }
  }
}
