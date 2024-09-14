import '../../config/env';
import jwt from 'jsonwebtoken';
import { InternalServerError } from '../../errors/internalServerError';
export class newToken {
  static access(userId: string) {
    try {
      return jwt.sign({ id: userId }, process.env.ACCESS_SECRET_KEY!, {
        algorithm: 'HS512',
        expiresIn: '1h'
      });
    } catch (err) {
      throw new InternalServerError('access토큰 발급 오류');
    }
  }

  static refresh() {
    try {
      return jwt.sign({}, process.env.REFRESH_SECRET_KEY!, {
        algorithm: 'HS512', // SHA512
        expiresIn: '7d'
      });
    } catch (err) {
      throw new InternalServerError('refresh토큰 발급 오류');
    }
  }
}
