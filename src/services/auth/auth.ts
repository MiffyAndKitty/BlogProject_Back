import { db } from '../../loaders/mariadb';
import { getHashed } from '../../utils/getHashed';
import { UserDto } from '../../interfaces/user';
import { ensureError } from '../../errors/ensureError';
import { redis } from '../../loaders/redis';
export class AuthService {
  static deleteToken = async (userId: string) => {
    try {
      const deleted = await redis.del(`refreshToken:${userId}`);
      if (deleted === 1) {
        return { result: true, message: '로그아웃 성공' };
      } else {
        return { result: false, message: 'refresh 토큰 삭제 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static saveUser = async (userDto: UserDto) => {
    try {
      const hashed = await getHashed(userDto.password);

      const saved = await db.query(
        'INSERT INTO User (user_email, user_password, user_nickname) VALUES (?, ?, ?)',
        [userDto.email, hashed, userDto.nickname]
      );

      if (saved.affectedRows === 1) {
        return { result: true, message: '회원 정보 저장 성공' };
      } else {
        return { result: false, message: '회원 정보 저장 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
