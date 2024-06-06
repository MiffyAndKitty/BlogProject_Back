import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { ensureError } from '../../errors/ensureError';
export class newToken {
  static access(userId: string) {
    try {
      return jwt.sign({ id: userId }, process.env.ACCESS_SECRET_KEY!, {
        algorithm: 'HS512',
        expiresIn: '1h'
      });
    } catch (err) {
      const error = ensureError(err);
      console.log('access토큰 발급 오류 : ', error.message);
      return { result: false, message: error.message };
    }
  }
  static refresh() {
    try {
      return jwt.sign({}, process.env.REFRESH_SECRET_KEY!, {
        algorithm: 'HS512', // SHA512
        expiresIn: '7d'
      });
    } catch (err) {
      const error = ensureError(err);
      console.log('refresh토큰 발급 오류 : ', error.message);
      return { result: false, message: error.message };
    }
  }
}
