import { BaseError } from './baseError';
import { ERROR_NAMES, ERROR_MESSAGES, ERROR_CODES } from '../constants/errors';

export class InternalServerError extends BaseError<
  typeof ERROR_NAMES.INTERNAL_SERVER
> {
  constructor(message: string = ERROR_MESSAGES.INTERNAL_SERVER, cause?: any) {
    super({
      name: ERROR_NAMES.INTERNAL_SERVER,
      message,
      code: ERROR_CODES.INTERNAL_SERVER,
      cause
    });
  }
}
