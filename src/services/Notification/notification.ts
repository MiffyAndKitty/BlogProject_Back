import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse, MultipleDataResponse } from '../../interfaces/response';
import { UserIdDto } from '../../interfaces/user/userInfo';
import { UserNotificationDto } from '../../interfaces/notification';

export class NotificationService {
  static async getAll(
    userIdDto: UserIdDto
  ): Promise<MultipleDataResponse<object>> {
    try {
      const result = await db.query(
        `SELECT * FROM Notifications 
        WHERE notification_recipient = ? AND deleted_at IS NULL 
        ORDER BY created_at DESC;`,
        [userIdDto.userId]
      );

      return {
        result: true,
        data: result,
        message: '알림 리스트 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
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
