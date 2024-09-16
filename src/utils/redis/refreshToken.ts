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

    const setted = await redis.set(
      `${cacheKey}${userId}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7주일 뒤 만료
    );
    console.log('리프레시 토큰 설정 : ', setted);

    return setted;
  } catch (err) {
    throw ensureError(err, 'refresh 토큰 저장 오류');
  }
}

export async function getRefreshToken(
  userId: string,
  isGoogle: boolean = false
) {
  try {
    console.log('isGoogle', isGoogle);

    const cacheKey = isGoogle
      ? CacheKeys.GOOGLE_REFRESHTOKEN
      : CacheKeys.REFRESHTOKEN;

    const key = `${cacheKey}${userId}`;
    console.log('리프레시 토큰 키값: ', key);
    const got = await redis.get(key);
    console.log('리프레시 토큰 반환 : ', got);

    return got;
  } catch (err) {
    throw ensureError(err, 'refresh 토큰 반환 오류');
  }
}
