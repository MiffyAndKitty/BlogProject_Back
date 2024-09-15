import { BaseError } from './baseError';
import { InternalServerError } from './internalServerError';

export function ensureError(err: unknown, errName?: string): BaseError<string> {
  if (err instanceof BaseError) return err;

  let stringified: string;
  try {
    stringified = JSON.stringify(err);
  } catch {
    stringified = '알 수 없는 에러';
  }

  return new InternalServerError(
    `${errName ?? '알 수 없는 에러'} : ${stringified}`
  );
}
