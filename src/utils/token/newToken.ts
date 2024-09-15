import '../../config/env';
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
      throw ensureError(err, 'access토큰 발급 오류');
    }
  }

  static refresh() {
    try {
      return jwt.sign({}, process.env.REFRESH_SECRET_KEY!, {
        algorithm: 'HS512', // SHA512
        expiresIn: '7d'
      });
    } catch (err) {
      throw ensureError(err, 'refresh토큰 발급 오류');
    }
  }
}
