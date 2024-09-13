import { UnauthorizedError } from './unauthorizedError';
import { BadRequestError } from './badRequestError';
import { ensureError } from './ensureError';

export function verifyTokenError(err: unknown): Error {
  const error = ensureError(err);
  switch (error.name) {
    case 'TokenExpiredError':
      return new UnauthorizedError('만료된 토큰입니다.');
    case 'JsonWebTokenError':
      return new BadRequestError('유효하지 않은 토큰입니다.');
    case 'TypeError':
      return new BadRequestError('잘못된 타입의 토큰입니다.');
    default:
      return error;
  }
}
