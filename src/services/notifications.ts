import { Response } from 'express';
import { db } from '../loaders/mariadb';
import { v4 as uuidv4 } from 'uuid';
import { redis } from '../loaders/redis';
import { clientsService } from '../utils/notification/clients';
import { NotificationDto } from '../interfaces/notification';
import { ensureError } from '../errors/ensureError';
export class NotificationService {
  static async createNotification(notificationDto: NotificationDto) {
    notificationDto.id = uuidv4().replace(/-/g, '');

    try {
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

      console.log('알림 데이터 notificationDto ', notificationDto);
      console.log('알림을 데이터베이스에 저장한 결과 ', stored);

      // SSE로 실시간 알림 전송 시도
      return await this.sendNotification(notificationDto);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }

  static async sendNotification(notificationDto: NotificationDto) {
    try {
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
      } else {
        const cashed = await redis.lpush(
          `notification:${notificationDto.recipient}`,
          JSON.stringify(notificationDto)
        );
        console.log('비로그인 사용자의 알림 캐시 결과 :', cashed);
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
