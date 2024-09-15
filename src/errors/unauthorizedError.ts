import { BaseError } from './baseError';
import { ERROR_NAMES, ERROR_MESSAGES, ERROR_CODES } from '../constants/errors';

export class UnauthorizedError extends BaseError<
  typeof ERROR_NAMES.UNAUTHORIZED
> {
  constructor(message: string = ERROR_MESSAGES.UNAUTHORIZED, cause?: any) {
    super({
      name: ERROR_NAMES.UNAUTHORIZED,
      message,
      code: ERROR_CODES.UNAUTHORIZED,
      cause
    });
  }
}
