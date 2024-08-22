import { redis } from '../../loaders/redis';
import { ensureError } from '../../errors/ensureError';

export async function setRefreshToken(userId: string, refreshToken: string) {
  try {
    return await redis.set(
      `refreshToken:${userId}`,
      refreshToken,
      'EX',
      7 * 24 * 60 * 60 // 7주일 뒤 만료
    );
  } catch (err) {
    const error = ensureError(err);
    console.log('refresh 토큰 저장 오류 : ', error.message);
    return error.name;
  }
}

export async function getRefreshToken(userId: string) {
  try {
    const key = `refreshToken:${userId}`;
    return await redis.get(key);
  } catch (err) {
    const error = ensureError(err);
    console.log('refresh 토큰 반환 오류 : ', error.message);
    return error.name;
  }
}
