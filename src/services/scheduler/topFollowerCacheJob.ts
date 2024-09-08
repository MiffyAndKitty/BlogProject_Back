import { CacheKeys } from '../../constants/cacheKeys';
import { db } from '../../loaders/mariadb';
import { cacheToRedisWithScores } from '../../utils/redis/cacheToRedisWithScores';
import { transformToZaddEntries } from '../../utils/redis/formatForZadd';
import moment from 'moment';

export class TopFollowersCacheJobService {
  static async cacheTopFollowers(
    key: typeof CacheKeys.TOP_FOLLOWERS,
    limit: number = 10
  ): Promise<boolean> {
    try {
      const { startDate, endDate } = this._getLastWeekPeriod();

      let topFollowers = await this._getTopFollowers(startDate, endDate, limit);

      if (topFollowers.length < limit) {
        topFollowers = await this._addRandomFollowers(topFollowers, limit);
      }

      if (topFollowers.length === 0) {
        console.log('유저가 존재하지 않습니다. 캐싱을 중단합니다.');
        return false;
      }

      const flatFollowers = transformToZaddEntries(
        topFollowers,
        'user_nickname',
        'follower_count'
      );

      return await cacheToRedisWithScores(key, flatFollowers);
    } catch (err) {
      console.error('최다 팔로워 보유 블로거 캐싱 중 오류 발생:', err);
      return false;
    }
  }

  private static _getLastWeekPeriod() {
    const now = moment();
    const lastMonday = moment(now).subtract(1, 'weeks').startOf('isoWeek'); // 지난 주 월요일 0시 0분 0초
    const lastSunday = moment(lastMonday).endOf('isoWeek'); // 지난 주 일요일 23시 59분 59초

    return {
      startDate: lastMonday.format('YYYY-MM-DD HH:mm:ss'),
      endDate: lastSunday.format('YYYY-MM-DD HH:mm:ss')
    };
  }

  private static async _getTopFollowers(
    startDate: string,
    endDate: string,
    limit: number
  ) {
    return db.query(
      `
      SELECT u.user_nickname, COUNT(f.followed_id) AS follower_count
      FROM User u
      JOIN Follow f ON u.user_id = f.followed_id
      WHERE u.deleted_at IS NULL
        AND f.deleted_at IS NULL
        AND f.created_at >= ? AND f.created_at <= ?
      GROUP BY u.user_id
      ORDER BY follower_count DESC
      LIMIT ?;
      `,
      [startDate, endDate, limit]
    );
  }

  private static async _addRandomFollowers(
    topFollowers: { user_nickname: string; follower_count: string }[],
    limit: number
  ) {
    const numberOfAdditionalFollowers = limit - topFollowers.length;

    const existingFollowerNames = topFollowers.map(
      (follower) => follower.user_nickname
    );

    const query = `
      SELECT u.user_nickname, COUNT(f.followed_id) AS follower_count
      FROM User u
      JOIN Follow f ON u.user_id = f.followed_id
      WHERE u.deleted_at IS NULL
        AND f.deleted_at IS NULL
       ${existingFollowerNames.length > 0 ? `AND user_nickname NOT IN (${existingFollowerNames.map(() => '?').join(',')})` : ''} 
      GROUP BY u.user_nickname
      ORDER BY RAND()
      LIMIT ?;
      `;

    const params =
      existingFollowerNames.length > 0
        ? [...existingFollowerNames, numberOfAdditionalFollowers]
        : [numberOfAdditionalFollowers];

    const additionalFollowers = await db.query(query, params);

    for (const follower of additionalFollowers) {
      topFollowers.push({
        user_nickname: follower.user_nickname,
        follower_count: '0'
      });
    }

    return topFollowers;
  }
}
