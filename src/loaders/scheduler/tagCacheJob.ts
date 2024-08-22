import schedule from 'node-schedule';
import { db } from '../mariadb';
import { redis } from '../redis';

const scheduleConfig = {
  hour: 1,
  minute: 0,
  tz: 'Asia/Seoul'
};

const cacheTags = async (key: string, limit: number) => {
  try {
    // 1시간 마다 전체 게시글에서 가장 많이 사용된 태그를 조회
    const tags = await db.query(
      `SELECT tag_name, COUNT(*) AS count
       FROM Board_Tag
       GROUP BY tag_name
       ORDER BY count DESC,  MAX(created_at) DESC
       LIMIT ?`,
      [limit]
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

    if (flatTags.length === 0) {
      console.log('게시글에 사용된 태그가 존재하지 않습니다.');
      return false;
    }

    const result = await Promise.all([
      await redis.del(key),
      await redis.zadd(key, ...flatTags)
    ]);
    console.log('인기 태그 캐싱 결과 :', result);

    return true;
  } catch (err) {
    console.error('태그 캐싱 중 오류 발생:', err);
    return false;
  }
};

export const tagCacheJob = (limit: number) =>
  schedule.scheduleJob(scheduleConfig, () => {
    cacheTags('tag_popular', limit);
  });
