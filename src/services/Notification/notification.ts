import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import {
  BasicResponse,
  MultipleDataResponse,
  ListResponse
} from '../../interfaces/response';
import {
  NotificationListDto,
  UserNotificationDto
} from '../../interfaces/notification';

export class NotificationService {
  static async getAll(listDto: NotificationListDto): Promise<ListResponse> {
    try {
      const [countResult] = await db.query(
        `SELECT COUNT(*) AS totalCount 
       FROM Notifications 
       WHERE notification_recipient = ? 
         AND deleted_at IS NULL`,
        [listDto.userId]
      );

      const pageSize = listDto.pageSize || 10;
      console.log(pageSize);
      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize);

      let query = `
      SELECT 
        Notifications.*, 
        User.user_nickname AS trigger_nickname, 
        User.user_email AS trigger_email, 
        User.user_image AS trigger_image,
        Board.board_title AS board_title,
        Comment.comment_content AS comment_content 
      FROM Notifications
      JOIN User ON Notifications.notification_trigger = User.user_id
      LEFT JOIN Board ON Notifications.notification_location = Board.board_id 
      LEFT JOIN Comment ON Notifications.notification_location = Comment.comment_id 
      WHERE Notifications.notification_recipient = ? 
        AND Notifications.deleted_at IS NULL
    `;

      const params: (string | number)[] = [listDto.userId];

      // 커서가 있을 경우 커서 이후의 데이터를 가져오기 위해 조건 추가
      if (listDto.cursor) {
        const [notificationByCursor] = await db.query(
          `SELECT notification_order 
         FROM Notifications 
         WHERE notification_id = ?`,
          [listDto.cursor]
        );

        if (!notificationByCursor) throw new Error('유효하지 않은 커서입니다.');

        query += ` AND notification_order ${listDto.isBefore ? '<' : '>'} ? `;
        params.push(notificationByCursor.notification_order);
      }

      query += ` ORDER BY Notifications.notification_order ASC LIMIT ?`;
      params.push(pageSize);
      const result = await db.query(query, params);

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

  static async get(
    userNotificationDto: UserNotificationDto
  ): Promise<MultipleDataResponse<object> | MultipleDataResponse<null>> {
    try {
      const notification = await db.query(
        `SELECT * FROM Notifications 
        WHERE notification_recipient = ? AND notification_id = ? AND deleted_at IS NULL 
        LIMIT 1;`,
        [userNotificationDto.userId, userNotificationDto.notificationId]
      );

      return notification.length === 1
        ? {
            result: true,
            data: notification,
            message: '알림 조회 성공'
          }
        : {
            result: false,
            data: [],
            message: '알림 조회 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
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
