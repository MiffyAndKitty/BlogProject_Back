import { Response } from 'express';
import { db } from '../../loaders/mariadb';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../../loaders/redis';
import { clientsService } from '../../utils/notification/clients';
import { NotificationDto } from '../../interfaces/notification';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse } from '../../interfaces/response';
export class saveNotificationService {
  static async createNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    notificationDto.id = uuidv4().replace(/-/g, '');

    try {
      if (notificationDto.type === 'new-follower') {
        // 단일 사용자에게 알림
        const stored = await db.query(
          `INSERT INTO Notifications (notification_id, notification_recipient, notification_trigger, notification_type, notification_location)
           VALUES (?, ?, ?, ?, ?)`,
          [
            notificationDto.id,
            notificationDto.recipient,
            notificationDto.trigger,
            notificationDto.type,
            notificationDto.location
          ]
        );

        // 단일 사용자에게 알림 전송
        return await this.sendNotification(notificationDto);
      }

      let userList: string[] = [];
      if (notificationDto.type === 'following-new-board') {
        // 팔로워 목록 가져오기
        const followers = await db.query(
          `SELECT following_id 
           FROM Follow
           WHERE followed_id = ? AND deleted_at IS NULL;`,
          [notificationDto.trigger]
        );

        // 각 객체의 'following_id'를 추출하여 새로운 배열로 재구성
        userList = followers.map(
          (follower: { following_id: string }) => follower.following_id
        );
      }

      if (userList.length === 0) {
        return {
          result: true,
          message: '알림을 전달할 유저가 존재하지 않음'
        };
      }

      // 각 팔로워에게 알림 저장 및 전송
      for (const user of userList) {
        if (!user) {
          console.error('다음 팔로워의 following_id가 없습니다:', user);
          continue; // following_id가 없으면 다음 반복으로 넘어감
        }

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
            userNotificationDto.trigger,
            userNotificationDto.type,
            userNotificationDto.location
          ]
        );

        // SSE 또는 Redis로 알림 전송
        const notified = await this.sendNotification(userNotificationDto);
        console.log('레디스에 알림 저장 성공/ 알림 실시간 전달 : ', notified);
      }
      return {
        result: true,
        message: '게시글의 팔로워들에게 알림 전달 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  static async sendNotification(
    notificationDto: NotificationDto
  ): Promise<BasicResponse> {
    try {
      // 클라이언트가 SSE로 연결되어 있는지 확인
      const client: Response | undefined = clientsService.get(
        notificationDto.recipient as string
      );

      if (client) {
        // client가 정의되어 있으면 알림 전송
        client.write(`data: ${JSON.stringify(notificationDto)}\n\n`);
        return {
          result: true,
          message: 'client가 로그인되어 있어 실시간 알림 전송됨'
        };
      } else {
        // 클라이언트가 연결되지 않은 경우 Redis에 알림 캐싱
        const cashed = await redis.lpush(
          `notification:${notificationDto.recipient}`,
          JSON.stringify(notificationDto)
        );

        return cashed
          ? {
              result: true,
              message:
                '클라이언트가 연결되어 있지 않음, Redis에 알림을 저장 완료'
            }
          : {
              result: false,
              message:
                '클라이언트가 연결되어 있지 않음, Redis에 알림을 저장 실패'
            };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }
}
