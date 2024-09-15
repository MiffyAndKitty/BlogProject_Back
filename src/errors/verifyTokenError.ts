import { UnauthorizedError } from './unauthorizedError';
import { BadRequestError } from './badRequestError';
import { ensureError } from './ensureError';

export function verifyTokenError(err: unknown): Error {
  const error = ensureError(err);
  switch (error.name) {
    case 'TokenExpiredError':
      throw new UnauthorizedError('만료된 토큰입니다.');
    case 'JsonWebTokenError':
      throw new BadRequestError('유효하지 않은 토큰입니다.');
    case 'TypeError':
      throw new BadRequestError('잘못된 타입의 토큰입니다.');
    default:
      throw ensureError(err, '토큰 유효성 검증 에러');
  }
}
