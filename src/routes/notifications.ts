import { Router, Request, Response } from 'express';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { redis } from '../loaders/redis';
import { clientsService } from '../utils/notification/clients';
import { ensureError } from '../errors/ensureError';
export const notificationsRouter = Router();

notificationsRouter.get(
  '/stream',
  jwtAuth,
  async (req: Request, res: Response) => {
    if (!req.id) {
      return res
        .status(401)
        .send({ result: false, message: '유효하지 않은 토큰' });
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
        const cachedNotifications = await redis.zrevrange(key, -1, 0);

        // 클라이언트로 캐시된 알림 전송
        cachedNotifications.forEach((notification, index) => {
          res.write(`id: ${index}\n`);
          res.write(`event: cashed-notification\n`);
          res.write(`data: ${notification}\n\n`);
        });

        // 알림 전송 후 Redis에서 삭제
        const deleted = await redis.del(key);
        deleted > 0
          ? console.log(`Redis에 캐시된 알림 전송 후, ${key} 삭제 완료`)
          : console.log(`Redis에 캐시된 알림 전송 후, ${key} 삭제 실패`);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);
