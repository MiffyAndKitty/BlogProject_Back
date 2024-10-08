import { CacheKeys } from '../../constants/cacheKeys';
import { TAG_CASH_LIMIT } from '../../constants/cashLimit';
import { ensureError } from '../../errors/ensureError';
import { db } from '../../loaders/mariadb';
import { cacheToRedisWithScores } from '../../utils/redis/cacheToRedisWithScores';
import { transformToZaddEntries } from '../../utils/redis/formatForZadd';

export class TagCacheJobService {
  static async cacheTags() {
    const { startTime, endTime } = this._getCurrentHourPeriod();

    let tags = await this._getTags(startTime, endTime);

    if (tags.length < TAG_CASH_LIMIT) {
      tags = await this._addRandomTags(tags);
    }

    if (tags.length === 0) {
      console.log('태그가 존재하지 않습니다. 캐싱을 중단합니다.');
      return false;
    }

    const flatTags = transformToZaddEntries(tags, 'tag_name', 'count');

    return await cacheToRedisWithScores(CacheKeys.POPULAR_TAGS, flatTags);
  }

  private static _getCurrentHourPeriod() {
    const now = new Date();
    const startTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
    startTime.setMinutes(0, 0, 0); // n시 0분 0초로 설정
    const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

    return { startTime, endTime };
  }

  private static async _getTags(startTime: Date, endTime: Date) {
    try {
      return db.query(
        `SELECT tag_name, COUNT(*) AS count
       FROM Board_Tag
       WHERE created_at >= ? AND created_at < ?
       GROUP BY tag_name
       ORDER BY count DESC, MAX(created_at) DESC
       LIMIT ?`,
        [startTime, endTime, TAG_CASH_LIMIT]
      );
    } catch (err) {
      throw ensureError(err, '태그를 가져오는 쿼리 중 오류 발생');
    }
  }

  private static async _addRandomTags(
    tags: { tag_name: string; count: string }[]
  ) {
    try {
      const numberOfAdditionalTags = TAG_CASH_LIMIT - tags.length;

      // 기존 태그 이름들을 배열로 추출
      const existingTagNames = tags.map((tag) => tag.tag_name);

      // existingTagNames가 비어 있으면 NOT IN 절을 생략
      const query = `
    SELECT tag_name 
    FROM Board_Tag
    WHERE deleted_at IS NULL 
    ${existingTagNames.length > 0 ? `AND tag_name NOT IN (${existingTagNames.map(() => '?').join(',')})` : ''}
    GROUP BY tag_name
    ORDER BY RAND()
    LIMIT ?`;

      // 기존 태그가 없을 경우에는 numberOfAdditionalTags만 파라미터로 사용
      const params =
        existingTagNames.length > 0
          ? [...existingTagNames, numberOfAdditionalTags]
          : [numberOfAdditionalTags];

      const additionalTags = await db.query(query, params);

      // 추가된 태그를 tags 배열에 추가
      for (const tag of additionalTags) {
        tags.push({
          tag_name: tag.tag_name,
          count: '0' // 추가된 태그의 count는 0으로 설정하여 구분
        });
      }

      return tags;
    } catch (err) {
      throw ensureError(err, '랜덤 태그 생성 중 오류 발생');
    }
  }
}
