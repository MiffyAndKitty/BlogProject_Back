import { BaseError } from './baseError';
import { ERROR_NAMES, ERROR_MESSAGES, ERROR_CODES } from '../constants/errors';

export class BadRequestError extends BaseError<typeof ERROR_NAMES.BAD_REQUEST> {
  constructor(message: string = ERROR_MESSAGES.BAD_REQUEST, cause?: any) {
    super({
      name: ERROR_NAMES.BAD_REQUEST,
      message,
      code: ERROR_CODES.BAD_REQUEST,
      cause
    });
  }
}
