import { Router, Request, Response } from 'express';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { redis } from '../loaders/redis';
import { validate } from '../middleware/express-validation';
import { header, query, body } from 'express-validator';
import { clientsService } from '../utils/notification/clients';
import { ensureError } from '../errors/ensureError';
import { NotificationService } from '../services/Notification/notification';
import {
  NotificationListDto,
  UserNotificationDto
} from '../interfaces/notification';
export const notificationsRouter = Router();

notificationsRouter.get(
  '/stream',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    if (!req.id) {
      return res.status(401).send({
        result: false,
        message: req.tokenMessage || '유효하지 않은 토큰'
      });
    }

    // SSE 헤더 설정
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (res.flushHeaders) {
      res.flushHeaders();
    } else {
      return res.status(500).send({
        result: false,
        message: 'SSE 헤더 설정 후 플러시하여 연결을 열어두기에 실패했습니다.'
      });
    }

    // 클라이언트 저장
    clientsService.add(req.id, res);

    // 주기적인 더미 데이터 전송을 위한 setInterval
    const intervalId = setInterval(() => {
      res.write(
        `data: ${JSON.stringify({ message: 'sse 지속적인 연결을 위한 더미데이터 전송', time: new Date().toLocaleTimeString() })}\n\n`
      );
    }, 30000);

    // 연결이 닫힐 때 처리
    req.on('close', () => {
      clearInterval(intervalId); // 인터벌 중지
      if (req.id) clientsService.delete(req.id);
      console.log('연결이 닫혀서 클라이언트를 제거');
    });

    req.on('timeout', () => {
      clearInterval(intervalId); // 인터벌 중지
      if (req.id) clientsService.delete(req.id);
      console.log('연결이 timeout되어 클라이언트를 제거');
    });

    try {
      const key = 'notification:' + req.id;
      const isExistCached = await redis.exists(key); // 캐시된 알림 존재하는지 확인

      if (isExistCached) {
        // 캐시된 알림이 있다면 클라이언트로 전송
        const cachedNotifications = await redis.lrange(key, 0, -1); // Redis 리스트 사용

        // 클라이언트로 캐시된 알림 전송
        cachedNotifications.forEach((notification, index) => {
          res.write(`id: ${index}\n`);
          res.write(`event: cashed-notification\n`);
          res.write(`data: ${notification}\n\n`);
        });

        // 알림 전송 후 Redis에서 삭제
        const deleted = await redis.unlink(key);
        deleted > 0
          ? console.log(`Redis에 캐시된 알림 전송 후, ${key} 삭제 완료`)
          : console.log(`Redis에 캐시된 알림 전송 후, ${key} 삭제 실패`);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      if (!res.headersSent) {
        return res.status(500).send({ result: false, message: error.message });
      }
    }
  }
);

notificationsRouter.get(
  '/list',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('cursor').optional({ checkFalsy: true }).isString(),
    query('is-before')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value !== 'true' && value !== 'false') {
          throw new Error(
            'is-before 값이 존재한다면 true/false의 문자열이어야합니다.'
          );
        }
        return true;
      }),
    query('sort')
      .optional({ checkFalsy: true })
      .isIn([
        'new-follower',
        'following-new-board',
        'comment-on-board',
        'board-new-like',
        'reply-to-comment',
        'broadcast'
      ])
      .withMessage(
        'sort의 값이 존재한다면 알림 타입값 중 하나의 값이어야합니다.'
      )
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }

      const listDto: NotificationListDto = {
        userId: req.id,
        pageSize: req.query['page-size'] as unknown as number,
        cursor: req.query.cursor as string,
        isBefore: req.query['is-before'] === 'true' ? true : false,
        sort: req.query.sort as string
      };

      const result = await NotificationService.getAll(listDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);

notificationsRouter.delete(
  '/',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('notificationId').isString()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }

      const userNotificationDto: UserNotificationDto = {
        userId: req.id,
        notificationId: req.body.notificationId
      };

      const result = await NotificationService.delete(userNotificationDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);
