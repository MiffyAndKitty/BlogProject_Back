import { Response, Request } from 'express';
import { clientsService } from '../notification/clients';
import { ensureError } from '../../errors/ensureError';

export function handleClientClose(
  req: Request,
  res: Response,
  intervalId: NodeJS.Timeout
): void {
  try {
    req.on('close', () => {
      clearInterval(intervalId);
      if (req.id) clientsService.delete(req.id);
      console.log('[연결 close] 클라이언트 제거');
    });

    req.on('timeout', () => {
      clearInterval(intervalId);
      if (req.id) clientsService.delete(req.id);
      console.log('[연결 timeout] 클라이언트 제거');
    });
  } catch (err) {
    throw ensureError(err, 'SSE 연결 종료 중 에러가 발생하였습니다.');
  }
}
