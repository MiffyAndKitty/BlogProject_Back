import { Response } from 'express';
import { db } from '../../loaders/mariadb';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../../loaders/redis';
import { clientsService } from '../../utils/notification/clients';
import {
  NotificationDto,
  RetryFailedUsersResult
} from '../../interfaces/notification';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse } from '../../interfaces/response';
import { CacheKeys } from '../../constants/cacheKeys';
import { NotificationName } from '../../constants/notificationName';
import { NotificationNameType } from '../../types/notification';

export class saveNotificationService {
  private static async _sendNotification(
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
        `${CacheKeys.NOTIFICATION}${notificationDto.recipient}`,
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

  static async createSingleUserNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      const location = this._selectLocation(
        notificationDto.type,
        notificationDto.location
      );

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
          location
        ]
      );

      if (savedCount > 0) {
        const sent = await this._sendNotification(notificationDto);
        return sent.result
          ? { result: true, message: '단일 사용자에게 알림 전송 성공' }
          : { result: false, message: '단일 사용자에게 알림 전송 실패' };
      }
      return { result: false, message: '단일 사용자에게 알림 저장 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  static async createMultiUserNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      let userList: string[] = [];
      const dbSaveFailedUserIds: string[] = []; // 데이터베이스에 저장 실패한 사용자 ID 저장
      const notificationFailedUserIds: string[] = []; // 알림 전송 실패한 사용자 ID 저장

      if (notificationDto.type === NotificationName.FOLLOWING_NEW_BOARD) {
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

      const location = this._selectLocation(
        notificationDto.type,
        notificationDto.location
      );

      // 각 팔로워에게 알림 저장 및 전송
      for (const user of userList) {
        if (!user) continue;

        const userNotificationId = uuidv4().replace(/-/g, '');
        const userNotificationDto: NotificationDto = {
          recipient: user,
          ...notificationDto,
          id: userNotificationId
        };

        // DB에 알림 저장
        const { affectedRows: savedCount } = await db.query(
          `INSERT INTO Notifications (notification_id, notification_recipient, notification_trigger, notification_type, notification_location)
         VALUES (?, ?, ?, ?, ?);`,
          [
            userNotificationDto.id,
            userNotificationDto.recipient,
            userNotificationDto.trigger.id,
            userNotificationDto.type,
            location
          ]
        );

        if (savedCount === 0) {
          dbSaveFailedUserIds.push(user); // 실패한 유저 ID 저장
          continue; // 데이터베이스에 저장 실패 시 알림 전송 시도하지 않음
        }

        // SSE 또는 Redis로 알림 전송
        const sent = await this._sendNotification(userNotificationDto);

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

      const retryResult: RetryFailedUsersResult = await this._retryFailedUsers(
        notificationDto,
        dbSaveFailedUserIds,
        notificationFailedUserIds
      );

      if (retryResult.dbSaveFails.length || retryResult.notifyFails.length) {
        console.log(`DB에 저장 실패한 알림 : ${retryResult.dbSaveFails}`);
        console.log(`유저에게 전송 실패한 : ${retryResult.notifyFails}`);
        return {
          result: false,
          message: `일부 유저 혹은 전체 유저에게 알림 전달 실패`
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
  ): Promise<RetryFailedUsersResult> {
    const dbSaveFails: string[] = [];
    const notifyFails: string[] = [];

    for (const failedUser of dbSaveFailedUserIds) {
      const retryNotificationDto = {
        ...notificationDto,
        id: uuidv4().replace(/-/g, ''),
        recipient: failedUser
      };

      const { affectedRows: retrySavedCount } = await db.query(
        `INSERT INTO Notifications (notification_id, notification_recipient, notification_trigger, notification_type, notification_location) 
           VALUES (?, ?, ?, ?, ?);`,
        [
          retryNotificationDto.id,
          retryNotificationDto.recipient,
          retryNotificationDto.trigger.id,
          retryNotificationDto.type,
          location
        ]
      );

      if (retrySavedCount === 0) {
        notificationFailedUserIds.push(failedUser);
      }
      notifyFails.push(failedUser);
    }

    for (const failedUser of notificationFailedUserIds) {
      const retryNotificationDto = {
        ...notificationDto,
        id: uuidv4().replace(/-/g, ''),
        recipient: failedUser
      };

      const retrySended = await this._sendNotification(retryNotificationDto);

      if (!retrySended.result) {
        notifyFails.push(failedUser);
      }
    }

    return {
      dbSaveFails: dbSaveFails,
      notifyFails: notifyFails
    };
  }

  private static _selectLocation(
    type: NotificationNameType,
    location: NotificationDto['location']
  ): string | undefined {
    let selectedLocation;

    switch (type) {
      case NotificationName.REPLY_TO_COMMENT:
      case NotificationName.COMMENT_ON_BOARD:
        selectedLocation = location?.commentId;
        break;
      case NotificationName.FOLLOWING_NEW_BOARD:
      case NotificationName.BOARD_NEW_LIKE:
        selectedLocation = location?.boardId;
        break;
      case NotificationName.NEW_FOLLOWER:
      default:
        selectedLocation = undefined;
        break;
    }
    return selectedLocation;
  }
}
