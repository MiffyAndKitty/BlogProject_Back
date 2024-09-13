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
import { CacheKeys } from '../constants/cacheKeys';
import { NotificationName } from '../constants/notificationName';
import { setSSEHeaders } from '../utils/sse/setSSEHeaders';
import { handleClientClose } from '../utils/sse/handleClientClose';
import { handleError } from '../utils/errHandler';
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

    setSSEHeaders(res);

    // 클라이언트 저장
    clientsService.add(req.id, res);

    // 주기적인 더미 데이터 전송을 위한 setInterval
    const intervalId = setInterval(() => {
      res.write(
        `data: ${JSON.stringify({ message: 'sse 지속적인 연결을 위한 더미데이터 전송', time: new Date().toLocaleTimeString() })}\n\n`
      );
    }, 30000);

    handleClientClose(req, res, intervalId);

    try {
      const cachedNotifications = await NotificationService.getCached(req.id);

      // 클라이언트로 캐시된 알림 전송
      cachedNotifications.forEach((notification, index) => {
        res.write(`id: ${index}\n`);
        res.write(`event: cashed-notification\n`);
        res.write(`data: ${notification}\n\n`);
      });

      NotificationService.deleteCashed(req.id);
    } catch (err) {
      if (!res.headersSent) {
        handleError(err, res); // 중복 응답을 방지하기 위해 이미 응답 헤더를 전송하지 않은 경우에만 응답
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
      .toInt()
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('cursor')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i),
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
      .isIn(Object.values(NotificationName))
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
      handleError(err, res);
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
    body('notificationId').matches(/^[0-9a-f]{32}$/i)
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
      handleError(err, res);
    }
  }
);
