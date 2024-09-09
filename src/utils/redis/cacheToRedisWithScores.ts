import { redis } from '../../loaders/redis';
import { CacheKeys } from '../../constants/cacheKeys';

export const cacheToRedisWithScores = async (
  key: typeof CacheKeys.POPULAR_TAGS | typeof CacheKeys.TOP_FOLLOWERS,
  data: Array<string | number>
): Promise<boolean> => {
  try {
    if (data.length === 0) {
      console.log('캐시할 데이터가 존재하지 않습니다.');
      return false;
    }

    await redis.unlink(key);
    await redis.zadd(key, ...data); // 데이터를 스코어와 함께 추가

    return true;
  } catch (err) {
    console.error(`Redis 캐싱 중 오류 발생: ${err}`);
    return false;
  }
};
