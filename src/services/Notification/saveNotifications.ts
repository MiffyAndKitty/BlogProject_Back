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
import { InternalServerError } from '../../errors/internalServerError';
/*import { NotFoundError } from '../../errors/notFoundError';*/

export class SaveNotificationService {
  static async createSingleUserNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    const location = this._selectLocation(
      notificationDto.type,
      notificationDto.location
    );

    notificationDto.id = this._generateId();
    // 단일 사용자에게 알림 저장
    const savedCount = await this._saveNotificationToDb(
      notificationDto,
      location
    );

    if (savedCount > 0) {
      return await this._sendNotification(notificationDto);
    }
    throw new InternalServerError('단일 사용자에게 알림 저장 실패');
  }

  static async createMultiUserNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    const userList = await this._getUserList(notificationDto);
    if (userList.length === 0) {
      return {
        result: true,
        message: '알림을 전달 대상 유저가 존재하지 않습니다.'
      };
    }

    const location = this._selectLocation(
      notificationDto.type,
      notificationDto.location
    );
    const { dbSaveFailedUserIds, notificationFailedUserIds } =
      await this._notifyMultipleUsers(userList, notificationDto, location);

    if (
      dbSaveFailedUserIds.length === 0 &&
      notificationFailedUserIds.length === 0
    ) {
      return { result: true, message: '다수의 유저들에게 알림 전달 성공' };
    }

    await this._retryFailedUsers(
      notificationDto,
      dbSaveFailedUserIds,
      notificationFailedUserIds
    );

    return {
      result: true,
      message: '오류 발생 후 다수의 유저들에게 알림 재전달 성공'
    };
  }

  private static async _sendNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      if (!notificationDto.recipient) {
        throw new InternalServerError('알림 수신인이 정의되어 있지 않습니다');
        /*throw new NotFoundError('알림 수신인이 정의되어 있지 않습니다');*/
      }

      // 클라이언트가 SSE로 연결되어 있는지 확인
      const client: Response | undefined = clientsService.get(
        notificationDto.recipient
      );

      if (client) {
        // client가 정의되어 있으면 알림 전송
        this._sendViaSSE(client, notificationDto);
        return {
          result: true,
          message: '실시간 알림 전송됨'
        };
      }
      // 클라이언트가 연결되지 않은 경우 Redis에 알림 캐싱
      await this._cacheNotification(notificationDto);

      return {
        result: true,
        message: 'Redis에 알림 저장 완료'
      };
    } catch (err) {
      throw ensureError(err, 'Redis에 알림 저장 중 에러 발생');
    }
  }

  private static _sendViaSSE(
    client: Response,
    notificationDto: NotificationDto
  ): void {
    try {
      client.write(`data: ${JSON.stringify(notificationDto)}\n\n`);
    } catch (err) {
      throw ensureError(err, 'SSE 알림 전달 중 에러 발생');
    }
  }

  private static async _cacheNotification(
    notificationDto: NotificationDto
  ): Promise<boolean> {
    try {
      const cached = await redis.lpush(
        // 추가 후 리스트의 새로운 길이 반환
        `${CacheKeys.NOTIFICATION}${notificationDto.recipient}`,
        JSON.stringify(notificationDto)
      );
      return cached > 0;
    } catch (err) {
      throw ensureError(err, '전달하지 못한 알림 캐시 중 에러 발생');
    }
  }

  private static _generateId(): string {
    return uuidv4().replace(/-/g, '');
  }

  private static async _getUserList(
    notificationDto: NotificationDto
  ): Promise<string[]> {
    try {
      if (notificationDto.type === NotificationName.FOLLOWING_NEW_BOARD) {
        const followers = await db.query(
          `SELECT following_id FROM Follow WHERE followed_id = ? AND deleted_at IS NULL;`,
          [notificationDto.trigger.id]
        );
        return followers.map(
          (follower: { following_id: string }) => follower.following_id
        );
      }
      return [];
    } catch (err) {
      throw ensureError(err, '팔로워 리스트 조회 중 에러 발생');
    }
  }

  private static async _notifyMultipleUsers(
    userList: string[],
    notificationDto: NotificationDto,
    location?: string
  ) {
    try {
      const dbSaveFailedUserIds: string[] = [];
      const notificationFailedUserIds: string[] = [];

      for (const user of userList) {
        if (!user) continue;

        const userNotificationDto: NotificationDto = {
          recipient: user,
          ...notificationDto,
          id: uuidv4().replace(/-/g, '')
        };

        const savedCount = await this._saveNotificationToDb(
          userNotificationDto,
          location
        );

        if (savedCount === 0) {
          dbSaveFailedUserIds.push(user);
          continue;
        }

        const sent = await this._sendNotification(userNotificationDto);

        if (!sent.result) {
          notificationFailedUserIds.push(user);
        }
      }

      return { dbSaveFailedUserIds, notificationFailedUserIds };
    } catch (err) {
      throw ensureError(err, '다수의 유저에게 알림 전송 중 에러 발생');
    }
  }

  private static async _saveNotificationToDb(
    notificationDto: NotificationDto,
    location?: string
  ): Promise<number> {
    try {
      const { affectedRows } = await db.query(
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
      return affectedRows;
    } catch (err) {
      throw ensureError(err, '데이터 베이스에 알림 저장 중 에러 발생');
    }
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

  private static async _retryFailedUsers(
    notificationDto: NotificationDto,
    dbSaveFailedUserIds: string[],
    notificationFailedUserIds: string[]
  ): Promise<boolean> {
    try {
      const retryResult: RetryFailedUsersResult = {
        dbSaveFails: await this._retryDbSave(
          notificationDto,
          dbSaveFailedUserIds
        ),
        notifyFails: await this._retryNotify(
          notificationDto,
          notificationFailedUserIds
        )
      };

      if (retryResult.dbSaveFails.length || retryResult.notifyFails.length) {
        console.log(
          '[알림 전달 재시도] DB 알림 저장 실패한 유저 : ',
          retryResult.dbSaveFails
        );
        console.log(
          '[알림 전달 재시도] 알림을 전달 받지 못한 유저 : ',
          retryResult.notifyFails
        );
        return false;
      }

      return true;
    } catch (err) {
      throw ensureError(err, '유저에게 알림 재전송 중 에러 발생');
    }
  }

  private static async _retryDbSave(
    notificationDto: NotificationDto,
    dbSaveFailedUserIds: string[]
  ): Promise<string[]> {
    try {
      const dbSaveFails: string[] = [];
      const location = this._selectLocation(
        notificationDto.type,
        notificationDto.location
      );

      for (const failedUser of dbSaveFailedUserIds) {
        const retryNotificationDto = this._createRetryNotification(
          notificationDto,
          failedUser
        );

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
          dbSaveFails.push(failedUser);
        }
      }
      return dbSaveFails;
    } catch (err) {
      throw ensureError(err, '데이터베이스에 알림 재저장 중 에러 발생');
    }
  }

  private static async _retryNotify(
    notificationDto: NotificationDto,
    FailedUserIds: string[]
  ): Promise<string[]> {
    try {
      const notifyFails: string[] = [];

      for (const failedUser of FailedUserIds) {
        const retryNotificationDto = this._createRetryNotification(
          notificationDto,
          failedUser
        );

        const retrySent = await this._sendNotification(retryNotificationDto);

        if (!retrySent.result) {
          notifyFails.push(failedUser);
        }
      }
      return notifyFails;
    } catch (err) {
      throw ensureError(err, '유저에게 알림 재전송 중 에러 발생');
    }
  }

  private static _createRetryNotification(
    notificationDto: NotificationDto,
    userId: string
  ): NotificationDto {
    return {
      ...notificationDto,
      id: this._generateId(),
      recipient: userId
    };
  }
}
