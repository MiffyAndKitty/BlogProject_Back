import { ensureError } from '../errors/ensureError';
import { TagDto } from '../interfaces/tag';
import { redis } from '../loaders/redis';

export class tagService {
  static getPopularList = async (tagDto: TagDto) => {
    try {
      const key = 'tag_popular';
      const tagNames = await redis.zrevrange(key, 0, tagDto.limit);

      return tagNames
        ? {
            result: true,
            data: tagNames,
            message: '인기 태그 조회 성공'
          }
        : {
            result: false,
            data: [],
            message: '인기 태그 조회 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return {
        result: false,
        data: null,
        message: error.message
      };
    }
  };
}
