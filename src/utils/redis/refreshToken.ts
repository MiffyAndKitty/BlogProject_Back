import { redis } from '../../loaders/redis';
import { CacheKeys } from '../../constants/cacheKeys';
import { ensureError } from '../../errors/ensureError';

export async function setRefreshToken(
  userId: string,
  refreshToken: string,
  isGoogle: boolean = false
) {
  try {
    const cacheKey = isGoogle
      ? CacheKeys.GOOGLE_REFRESHTOKEN
      : CacheKeys.REFRESHTOKEN;

    return await redis.set(
      `${cacheKey}${userId}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7주일 뒤 만료
    );
  } catch (err) {
    throw ensureError(err, 'refresh 토큰 저장 오류');
  }
}

export async function getRefreshToken(userId: string) {
  try {
    const key = `${CacheKeys.REFRESHTOKEN}${userId}`;
    return await redis.get(key);
  } catch (err) {
    throw ensureError(err, 'refresh 토큰 반환 오류');
  }
}
