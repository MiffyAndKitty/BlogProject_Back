import { redis } from '../../loaders/redis';
import { CacheKeys } from '../../constants/cacheKeys';
import { InternalServerError } from '../../errors/internalServerError';

export async function setRefreshToken(userId: string, refreshToken: string) {
  try {
    return await redis.set(
      `${CacheKeys.REFRESHTOKEN}${userId}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7주일 뒤 만료
    );
  } catch (err) {
    throw new InternalServerError('refresh 토큰 저장 오류');
  }
}

export async function getRefreshToken(userId: string) {
  try {
    const key = `${CacheKeys.REFRESHTOKEN}${userId}`;
    return await redis.get(key);
  } catch (err) {
    throw new InternalServerError('refresh 토큰 반환 오류');
  }
}
