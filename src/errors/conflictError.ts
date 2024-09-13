import { BaseError } from './baseError';
import { ERROR_NAMES, ERROR_MESSAGES, ERROR_CODES } from '../constants/errors';

export class ConflictError extends BaseError<typeof ERROR_NAMES.CONFLICT> {
  constructor(message: string = ERROR_MESSAGES.CONFLICT, cause?: any) {
    super({
      name: ERROR_NAMES.CONFLICT,
      message,
      code: ERROR_CODES.CONFLICT,
      cause
    });
  }
}
