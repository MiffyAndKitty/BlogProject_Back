import { BaseError } from './baseError';
import { ERROR_NAMES, ERROR_MESSAGES, ERROR_CODES } from '../constants/errors';

export class ForbiddenError extends BaseError<typeof ERROR_NAMES.FORBIDDEN> {
  constructor(message: string = ERROR_MESSAGES.FORBIDDEN, cause?: any) {
    super({
      name: ERROR_NAMES.FORBIDDEN,
      message,
      code: ERROR_CODES.FORBIDDEN,
      cause
    });
  }
}
