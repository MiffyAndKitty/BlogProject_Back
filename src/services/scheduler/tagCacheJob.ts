import { db } from '../../loaders/mariadb';
import { redis } from '../../loaders/redis';

export class TagCacheJobService {
  static async cacheTags(key: string, limit: number): Promise<boolean> {
    try {
      const now = new Date();
      const startTime = new Date(now.getTime() + 9 * 60 * 60 * 1000);
      startTime.setMinutes(0, 0, 0); // n시 0분 0초로 설정
      const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

      // 1시간 마다 전체 게시글에서 가장 많이 사용된 태그를 조회
      // 만약 사용된 횟수가 동일하다면 최신순으로 반환
      const tags = await db.query(
        `SELECT tag_name, COUNT(*) AS count
      FROM Board_Tag
      WHERE created_at >= ? AND created_at < ?
      GROUP BY tag_name
      ORDER BY count DESC, MAX(created_at) DESC
      LIMIT ?`,
        [startTime, endTime, limit]
      );

      // flatTags는 [score1, member1, score2, member2, ...] 형태
      const flatTags: Array<number | string> = tags.reduce(
        (
          acc: (string | number)[],
          tag: {
            count: string | number;
            tag_name: string;
          }
        ) => {
          // count(23n과 같은 형태)를 숫자로 변환하고 유효하지 않으면 기본값 0 설정
          const count = Number(tag.count) || 0;
          acc.push(count, tag.tag_name);
          return acc;
        },
        [] as (string | number)[]
      );

      // 만약 태그의 개수가 limit에 미치지 못하면 랜덤하게 추가 태그
      const numberOfAdditionalTags = limit - flatTags.length / 2;
      if (numberOfAdditionalTags > 0) {
        console.log(`${numberOfAdditionalTags}개의 추가 태그를 선택합니다.`);
        const existingTagNames = flatTags.filter((_, index) => index % 2 !== 0);

        const params =
          existingTagNames.length > 0
            ? [...existingTagNames, numberOfAdditionalTags]
            : [numberOfAdditionalTags];
        const additionalTags = await db.query(
          `SELECT tag_name FROM Board_Tag
            ${existingTagNames.length > 0 ? `WHERE tag_name NOT IN (${existingTagNames.map(() => '?').join(',')})` : ''}
           GROUP BY tag_name
           ORDER BY RAND()
           LIMIT ?`,
          params
        );

        for (const tag of additionalTags) {
          flatTags.push(0, tag.tag_name); // 추가된 태그는 score를 0으로 설정하여 식별
        }
      }
      console.log(flatTags);
      if (flatTags.length === 0) {
        console.log('게시글에 사용된 태그가 존재하지 않습니다.');
        return false;
      }

      const result = await Promise.all([
        await redis.unlink(key),
        await redis.zadd(key, ...flatTags)
      ]);
      console.log('인기 태그 캐싱 결과 :', result);

      return true;
    } catch (err) {
      console.error('태그 캐싱 중 오류 발생:', err);
      return false;
    }
  }
}
