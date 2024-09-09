import { db } from '../../loaders/mariadb';
import { getHashed } from '../../utils/getHashed';
import { SignUpDto } from '../../interfaces/auth';
import { ensureError } from '../../errors/ensureError';
import { redis } from '../../loaders/redis';
import { CacheKeys } from '../../constants/cacheKeys';
export class AuthService {
  static deleteToken = async (userId: string) => {
    try {
      const deleted = await redis.unlink(`${CacheKeys.REFRESHTOKEN}${userId}`);
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

  static saveUser = async (userDto: SignUpDto) => {
    try {
      let column;
      const params = [userDto.email, userDto.nickname];

      if (!userDto.password && userDto.provider) {
        column = 'user_provider';
        params.push(userDto.provider);
      } else if (userDto.password) {
        column = 'user_password';
        const hashed = await getHashed(userDto.password);
        params.push(hashed);
      }

      const saved = await db.query(
        `INSERT INTO User (user_email, user_nickname, ${column}) VALUES (?, ?, ?)`,
        params
      );

      if (saved.affectedRows !== 1) {
        return { result: false, message: '회원 정보 저장 실패' };
      }

      return userDto.provider
        ? { result: true, message: `${userDto.provider} 회원 정보 저장 성공` }
        : { result: true, message: '로컬 회원 정보 저장 성공' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
