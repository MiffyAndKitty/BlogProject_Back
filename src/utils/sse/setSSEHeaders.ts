import { Response } from 'express';
import { ensureError } from '../../errors/ensureError';
import { InternalServerError } from '../../errors/internalServerError';

export function setSSEHeaders(res: Response): void {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (res.flushHeaders) {
      res.flushHeaders();
    } else {
      throw new InternalServerError('SSE 헤더 설정 후 flushHeader() 실패');
    }
  } catch (err) {
    throw ensureError(
      err,
      'SSE 헤더 설정 중 에러 발생하였습니다. : ${(err as Error).message}'
    );
  }
}
