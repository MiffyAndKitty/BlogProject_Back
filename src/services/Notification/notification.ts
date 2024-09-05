import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse, ListResponse } from '../../interfaces/response';
import {
  NotificationListDto,
  UserNotificationDto
} from '../../interfaces/notification';

export class NotificationService {
  static async getAll(listDto: NotificationListDto): Promise<ListResponse> {
    try {
      const sortQuery = listDto.sort
        ? `AND notification_type = '${listDto.sort}'`
        : ``;
      const [countResult] = await db.query(
        `SELECT COUNT(*) AS totalCount 
       FROM Notifications 
       WHERE notification_recipient = ? 
         ${sortQuery}
         AND deleted_at IS NULL;`,
        [listDto.userId]
      );

      const pageSize = listDto.pageSize || 10;

      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize);

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
          WHEN Notifications.notification_type IN ('reply-to-comment', 'comment-on-board') THEN Notifications.notification_location
          ELSE NULL
        END AS notification_comment,
        CASE
          WHEN Notifications.notification_type IN ('following-new-board', 'board-new-like') THEN Notifications.notification_location
          WHEN Notifications.notification_type IN ('reply-to-comment', 'comment-on-board') THEN Comment.board_id
          ELSE NULL
        END AS notification_board,
        Board.board_title AS board_title,
        Comment.comment_content AS comment_content 
      FROM Notifications
      JOIN User ON Notifications.notification_trigger = User.user_id
      LEFT JOIN Comment ON Notifications.notification_location = Comment.comment_id
      LEFT JOIN Board ON Comment.board_id = Board.board_id
      WHERE Notifications.notification_recipient = ? 
        ${sortQuery}
        AND Notifications.deleted_at IS NULL
    `;

      const params: (string | number)[] = [listDto.userId];

      let order = 'DESC';
      // 커서가 있을 경우 커서 이후의 데이터를 가져오기 위해 조건 추가
      if (listDto.cursor) {
        const [{ notification_order: cursorOrder }] = await db.query(
          `SELECT notification_order 
         FROM Notifications 
         WHERE notification_id = ? ${sortQuery};`,
          [listDto.cursor]
        );

        if (!cursorOrder) throw new Error('유효하지 않은 커서입니다.');

        query += ` AND notification_order ${listDto.isBefore ? '>' : '<'} ?`;
        params.push(cursorOrder);

        if (listDto.isBefore) order = 'ASC';
      }

      query += ` ORDER BY notification_order ${order} LIMIT ?`;
      params.push(pageSize);

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
}
