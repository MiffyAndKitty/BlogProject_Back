import { LimitRequestDto } from '../interfaces/limitRequestDto';
import { redis } from '../loaders/redis';
import { CacheKeys } from '../constants/cacheKeys';
import { POPULAR_TAG_LIMIT } from '../constants/cashedListSizeLimit';
import { InternalServerError } from '../errors/internalServerError';

export class tagService {
  static getPopularList = async (tagDto: LimitRequestDto) => {
    const tagLimit = tagDto.limit || POPULAR_TAG_LIMIT;
    // 태그 이름과 함께 점수를 반환
    const cashedTags = await redis.zrevrange(
      CacheKeys.POPULAR_TAGS,
      0,
      tagLimit - 1,
      'WITHSCORES'
    );

    if (!cashedTags || cashedTags.length === 0) {
      throw new InternalServerError('캐시된 인기 태그 조회 실패');
    }

    // 태그와 점수를 객체 형태로 변환
    const tagWithScores = [];
    for (let i = 0; i < cashedTags.length; i += 2) {
      // `cashedTags` 배열을 순회
      tagWithScores.push({
        tagName: cashedTags[i],
        score: Number(cashedTags[i + 1])
      });
    }

    return {
      result: true,
      data: tagWithScores,
      message: '인기 태그 조회 성공'
    };
  };
}
