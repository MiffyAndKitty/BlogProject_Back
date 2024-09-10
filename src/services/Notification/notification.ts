import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse, ListResponse } from '../../interfaces/response';
import {
  NotificationListDto,
  UserNotificationDto
} from '../../interfaces/notification';
import { NotificationName } from '../../constants/notificationName';
import { isNotificationNameType } from '../../utils/typegaurd/isNotificationNameType';
import { CacheKeys } from '../../constants/cacheKeys';
import { redis } from '../../loaders/redis';
export class NotificationService {
  static async getAll(listDto: NotificationListDto): Promise<ListResponse> {
    try {
      const sortQuery = this._buildSortQuery(listDto.sort);

      const totalCount = await this._getTotalCount(listDto.userId, sortQuery);
      const pageSize = listDto.pageSize || 10;
      const totalPageCount = Math.ceil(totalCount / pageSize);

      const { query, params } = await this._buildQuery(listDto, sortQuery);
      const result = await db.query(query, params);

      if (listDto.cursor && listDto.isBefore) result.reverse();
      return {
        result: true,
        data: result,
        total: {
          totalCount: totalCount,
          totalPageCount: totalPageCount
        },
        message: '알림 리스트 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], total: null, message: error.message };
    }
  }

  static async getCached(userId: string): Promise<string[]> {
    const key = CacheKeys.NOTIFICATION + userId;
    const isExistCached = await redis.exists(key);

    if (isExistCached) {
      const cachedNotifications = await redis.lrange(key, 0, -1);
      return cachedNotifications;
    }

    return [];
  }

  static deleteCashed(userId: string) {
    try {
      const key = CacheKeys.NOTIFICATION + userId;
      redis.unlink(key);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
    }
  }

  static async delete(
    userNotificationDto: UserNotificationDto
  ): Promise<BasicResponse> {
    try {
      const result = await db.query(
        `UPDATE Notifications 
        SET deleted_at = NOW() 
        WHERE notification_recipient = ? AND notification_id = ? AND deleted_at IS NULL;`,
        [userNotificationDto.userId, userNotificationDto.notificationId]
      );

      return result.affectedRows > 0
        ? { result: true, message: '알림 삭제 성공' }
        : { result: false, message: '알림 삭제 실패 또는 이미 삭제됨' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  // 정렬 쿼리 빌드
  private static _buildSortQuery(sort: string): string {
    return isNotificationNameType(sort)
      ? `AND notification_type = '${sort}'`
      : '';
  }

  // 총 알림 수 조회
  private static async _getTotalCount(
    userId: string,
    sortQuery: string
  ): Promise<number> {
    const [countResult] = await db.query(
      `SELECT COUNT(*) AS totalCount 
       FROM Notifications 
       WHERE notification_recipient = ? 
         ${sortQuery}
         AND deleted_at IS NULL;`,
      [userId]
    );
    return Number(countResult.totalCount.toString());
  }
  // 쿼리 및 파라미터 빌드
  private static async _buildQuery(
    listDto: NotificationListDto,
    sortQuery: string
  ) {
    const pageSize = listDto.pageSize || 10;
    const params: (string | number)[] = [listDto.userId];
    let order = 'DESC';

    let query = `
      SELECT 
        Notifications.notification_id, 
        Notifications.notification_recipient, 
        Notifications.notification_type, 
        Notifications.notification_read, 
        Notifications.notification_trigger, 
        Notifications.created_at, 
        Notifications.updated_at, 
        Notifications.notification_order,     
        User.user_nickname AS trigger_nickname, 
        User.user_email AS trigger_email, 
        User.user_image AS trigger_image,
        CASE
          WHEN Notifications.notification_type IN ('${NotificationName.REPLY_TO_COMMENT}', '${NotificationName.COMMENT_ON_BOARD}') THEN Notifications.notification_location
          ELSE NULL
        END AS notification_comment,
        Comment.parent_comment_id AS parent_comment_id,
        CASE
          WHEN Notifications.notification_type IN ('${NotificationName.FOLLOWING_NEW_BOARD}', '${NotificationName.BOARD_NEW_LIKE}') THEN Notifications.notification_location
          WHEN Notifications.notification_type IN ('${NotificationName.REPLY_TO_COMMENT}', '${NotificationName.COMMENT_ON_BOARD}') THEN Comment.board_id
          ELSE NULL
        END AS notification_board,
        SUBSTRING(Board.board_title, 1, 30) AS board_title,
        BoardUser.user_nickname AS board_writer,
        SUBSTRING(Comment.comment_content, 1, 30) AS comment_content
      FROM Notifications
      JOIN User ON Notifications.notification_trigger = User.user_id
      LEFT JOIN Comment ON Notifications.notification_location = Comment.comment_id
      LEFT JOIN Board ON 
          (CASE 
              WHEN Notifications.notification_type IN ('${NotificationName.FOLLOWING_NEW_BOARD}', '${NotificationName.BOARD_NEW_LIKE}') THEN Notifications.notification_location
              WHEN Notifications.notification_type IN ('${NotificationName.REPLY_TO_COMMENT}', '${NotificationName.COMMENT_ON_BOARD}') THEN Comment.board_id
              ELSE NULL
          END) = Board.board_id
      LEFT JOIN User AS BoardUser ON Board.user_id = BoardUser.user_id 
      WHERE Notifications.notification_recipient = ? 
        ${sortQuery}
        AND Notifications.deleted_at IS NULL
    `;

    if (listDto.cursor) {
      const cursorOrder = await this._getCursorOrder(listDto.cursor, sortQuery);
      query += ` AND notification_order ${listDto.isBefore ? '>' : '<'} ?`;
      params.push(cursorOrder);

      if (listDto.isBefore) order = 'ASC';
    }

    query += ` ORDER BY notification_order ${order} LIMIT ?`;
    params.push(pageSize);

    return { query, params };
  }

  // 커서 정보 조회
  private static async _getCursorOrder(
    cursor: string,
    sortQuery: string
  ): Promise<number> {
    const [{ notification_order: cursorOrder }] = await db.query(
      `SELECT notification_order 
       FROM Notifications 
       WHERE notification_id = ? ${sortQuery};`,
      [cursor]
    );

    if (!cursorOrder) throw new Error('유효하지 않은 커서입니다.');
    return cursorOrder;
  }
}
