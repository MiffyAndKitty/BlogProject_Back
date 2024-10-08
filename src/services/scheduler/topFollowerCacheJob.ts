import { CacheKeys } from '../../constants/cacheKeys';
import { FOLLOWER_CASH_LIMIT } from '../../constants/cashLimit';
import { ensureError } from '../../errors/ensureError';
import { db } from '../../loaders/mariadb';
import { cacheToRedisWithScores } from '../../utils/redis/cacheToRedisWithScores';
import { transformToZaddEntries } from '../../utils/redis/formatForZadd';
import moment from 'moment';

export class TopFollowersCacheJobService {
  static async cacheTopFollowers() {
    const { startDate, endDate } = this._getLastWeekPeriod();

    let topFollowers = await this._getTopFollowers(startDate, endDate);

    if (topFollowers.length < FOLLOWER_CASH_LIMIT) {
      topFollowers = await this._addRandomFollowers(topFollowers);
    }

    if (topFollowers.length === 0) {
      console.log('팔로우 리스트가 존재하지 않습니다. 캐싱을 중단합니다.');
      return false;
    }

    const flatFollowers = transformToZaddEntries(
      topFollowers,
      'followed_id',
      'follower_count'
    );

    return await cacheToRedisWithScores(CacheKeys.TOP_FOLLOWERS, flatFollowers);
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

  private static async _getTopFollowers(startDate: string, endDate: string) {
    try {
      return db.query(
        `
      SELECT f.followed_id, COUNT(f.followed_id) AS follower_count
      FROM User u
      JOIN Follow f ON u.user_id = f.followed_id
      WHERE u.deleted_at IS NULL
        AND f.deleted_at IS NULL
        AND f.created_at >= ? AND f.created_at <= ?
      GROUP BY u.user_id
      ORDER BY follower_count DESC
      LIMIT ?;
      `,
        [startDate, endDate, FOLLOWER_CASH_LIMIT]
      );
    } catch (err) {
      throw ensureError(err, '지난 주의 최대 팔로워 유저 반환 에러');
    }
  }

  private static async _addRandomFollowers(
    topFollowers: { followed_id: string; follower_count: string }[]
  ) {
    try {
      const numberOfAdditionalFollowers =
        FOLLOWER_CASH_LIMIT - topFollowers.length;

      const existingFollowerNames = topFollowers.map(
        (follower) => follower.followed_id
      );

      const query = `
      SELECT f.followed_id, COUNT(f.followed_id) AS follower_count
      FROM User u
      JOIN Follow f ON u.user_id = f.followed_id
      WHERE u.deleted_at IS NULL
        AND f.deleted_at IS NULL
       ${existingFollowerNames.length > 0 ? `AND f.followed_id NOT IN (${existingFollowerNames.map(() => '?').join(',')})` : ''} 
      GROUP BY f.followed_id
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
          followed_id: follower.followed_id,
          follower_count: '0'
        });
      }

      return topFollowers;
    } catch (err) {
      throw ensureError(
        err,
        '주간 최대 팔로워 리스트의 랜덤 유저 생성 중 에러 발생'
      );
    }
  }
}
