import { BaseError } from './baseError';
import { ERROR_NAMES, ERROR_MESSAGES, ERROR_CODES } from '../constants/errors';

export class NotFoundError extends BaseError<typeof ERROR_NAMES.NOT_FOUND> {
  constructor(message: string = ERROR_MESSAGES.NOT_FOUND, cause?: any) {
    super({
      name: ERROR_NAMES.NOT_FOUND,
      message,
      code: ERROR_CODES.NOT_FOUND,
      cause
    });
  }
}
