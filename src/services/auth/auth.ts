import { db } from '../../loaders/mariadb';
import { getHashed } from '../../utils/getHashed';
import { SignUpDto } from '../../interfaces/auth';
import { redis } from '../../loaders/redis';
import { CacheKeys } from '../../constants/cacheKeys';
import { InternalServerError } from '../../errors/internalServerError';
export class AuthService {
  static deleteToken = async (userId: string) => {
    const deleted = await redis.unlink(`${CacheKeys.REFRESHTOKEN}${userId}`);
    if (deleted == 0) throw new InternalServerError('refresh 토큰 삭제 실패');

    return { result: true, message: '로그아웃 성공' };
  };

  static saveUser = async (userDto: SignUpDto) => {
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

    if (saved.affectedRows === 0)
      throw new InternalServerError('회원 정보 저장 실패');

    return userDto.provider
      ? { result: true, message: `${userDto.provider} 회원 정보 저장 성공` }
      : { result: true, message: '로컬 회원 정보 저장 성공' };
  };
}
