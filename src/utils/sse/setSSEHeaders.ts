import { Response, Request } from 'express';
import { ensureError } from '../../errors/ensureError';

export function setSSEHeaders(res: Response): void {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    if (res.flushHeaders) {
      res.flushHeaders();
    } else {
      throw new Error('[flushHeader() 에러] SSE 헤더 설정 후 플러시 실패');
    }
  } catch (err) {
    const error = ensureError(err);
    throw new Error('[SSE 헤더 설정 에러] ', error);
  }
}
