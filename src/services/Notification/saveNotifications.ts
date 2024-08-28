import { Response } from 'express';
import { db } from '../../loaders/mariadb';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../../loaders/redis';
import { clientsService } from '../../utils/notification/clients';
import { NotificationDto } from '../../interfaces/notification';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse } from '../../interfaces/response';
export class saveNotificationService {
  static async sendNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      if (!notificationDto.recipient) {
        throw new Error('알림 수신인이 정의되어 있지 않습니다');
      }

      // 클라이언트가 SSE로 연결되어 있는지 확인
      const client: Response | undefined = clientsService.get(
        notificationDto.recipient
      );

      if (client) {
        // client가 정의되어 있으면 알림 전송
        client.write(`data: ${JSON.stringify(notificationDto)}\n\n`);
        return {
          result: true,
          message: 'client가 로그인되어 있어 실시간 알림 전송됨'
        };
      }
      // 클라이언트가 연결되지 않은 경우 Redis에 알림 캐싱
      const cashed = await redis.lpush(
        `notification:${notificationDto.recipient}`,
        JSON.stringify(notificationDto)
      );

      return cashed
        ? {
            result: true,
            message: '클라이언트가 연결되어 있지 않음, Redis에 알림을 저장 완료'
          }
        : {
            result: false,
            message: '클라이언트가 연결되어 있지 않음, Redis에 알림을 저장 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  //  'new-follower',  'reply-to-comment', 'comment-on-board'
  static async createSingleUserNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      notificationDto.id = uuidv4().replace(/-/g, '');
      // 단일 사용자에게 알림 저장
      const { affectedRows: savedCount } = await db.query(
        `INSERT INTO Notifications (notification_id, notification_recipient, notification_trigger, notification_type, notification_location)
         VALUES (?, ?, ?, ?, ?)`,
        [
          notificationDto.id,
          notificationDto.recipient,
          notificationDto.trigger.id,
          notificationDto.type,
          notificationDto.location?.id || null
        ]
      );

      const sent = await this.sendNotification(notificationDto);

      return savedCount > 0 && sent.result
        ? { result: true, message: '단일 사용자에게 알림 전송 성공' }
        : { result: false, message: '단일 사용자에게 알림 전송 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  // 'following-new-board'
  static async createMultiUserNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      let userList: string[] = [];
      let dbSaveFailedUserIds: string[] = []; // 데이터베이스에 저장 실패한 사용자 ID 저장
      let notificationFailedUserIds: string[] = []; // 알림 전송 실패한 사용자 ID 저장

      if (notificationDto.type === 'following-new-board') {
        const followers = await db.query(
          `SELECT following_id 
         FROM Follow
         WHERE followed_id = ? AND deleted_at IS NULL;`,
          [notificationDto.trigger.id]
        );

        if (followers.length === 0) {
          return {
            result: true,
            message: '알림을 전달할 유저가 존재하지 않음'
          };
        }

        userList = followers.map(
          (follower: { following_id: string }) => follower.following_id
        );
      }

      // 각 팔로워에게 알림 저장 및 전송
      for (const user of userList) {
        if (!user) continue;

        const userNotificationId = uuidv4().replace(/-/g, '');
        const userNotificationDto: NotificationDto = {
          ...notificationDto,
          id: userNotificationId,
          recipient: user
        };

        // DB에 알림 저장
        const { affectedRows: savedCount } = await db.query(
          `INSERT INTO Notifications (notification_id, notification_recipient, notification_trigger, notification_type, notification_location)
         VALUES (?, ?, ?, ?, ?)`,
          [
            userNotificationDto.id,
            userNotificationDto.recipient,
            userNotificationDto.trigger.id,
            userNotificationDto.type,
            notificationDto.location?.id || null
          ]
        );

        if (savedCount === 0) {
          dbSaveFailedUserIds.push(user); // 실패한 유저 ID 저장
          continue; // 데이터베이스에 저장 실패 시 알림 전송 시도하지 않음
        }

        // SSE 또는 Redis로 알림 전송
        const sent = await this.sendNotification(userNotificationDto);

        if (!sent.result) {
          notificationFailedUserIds.push(user); // 실패한 유저 ID 저장
        }
      }

      if (
        dbSaveFailedUserIds.length === 0 &&
        notificationFailedUserIds.length === 0
      ) {
        return { result: true, message: '다수의 유저들에게 알림 전달 성공' };
      }

      const retryResult = await this._retryFailedUsers(
        notificationDto,
        dbSaveFailedUserIds,
        notificationFailedUserIds
      );

      if (retryResult.length > 0) {
        return {
          result: false,
          message: `일부 유저 혹은 전체 유저에게 알림 전달 실패\n실패한 유저 id : ${retryResult}`
        };
      }

      return {
        result: true,
        message: '오류 발생 후 다수의 유저들에게 알림 재전달 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  private static async _retryFailedUsers(
    notificationDto: NotificationDto,
    dbSaveFailedUserIds: string[],
    notificationFailedUserIds: string[]
  ): Promise<string[]> {
    let finalFailedUserIds: string[] = []; // 최종 실패한 사용자 ID 저장

    for (const failedUser of dbSaveFailedUserIds) {
      const retryNotificationDto = {
        ...notificationDto,
        id: uuidv4().replace(/-/g, ''),
        recipient: failedUser
      };

      const { affectedRows: retrySavedCount } = await db.query(
        `INSERT INTO Notifications (notification_id, notification_recipient, notification_trigger, notification_type, notification_location)
           VALUES (?, ?, ?, ?, ?)`,
        [
          retryNotificationDto.id,
          retryNotificationDto.recipient,
          retryNotificationDto.trigger.id,
          retryNotificationDto.type,
          retryNotificationDto.location?.id || null
        ]
      );

      if (retrySavedCount === 0) {
        finalFailedUserIds.push(failedUser);
      }
    }

    for (const failedUser of notificationFailedUserIds) {
      const retryNotificationDto = {
        ...notificationDto,
        id: uuidv4().replace(/-/g, ''),
        recipient: failedUser
      };

      const retrySended = await this.sendNotification(retryNotificationDto);

      if (!retrySended.result) {
        finalFailedUserIds.push(failedUser);
      }
    }

    return finalFailedUserIds;
  }
}
