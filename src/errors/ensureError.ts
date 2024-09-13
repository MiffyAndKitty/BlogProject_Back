import { BaseError } from './baseError';

export function ensureError(err: unknown): BaseError<string> {
  if (err instanceof BaseError) return err;

  let stringified: string;
  try {
    stringified = JSON.stringify(err);
  } catch {
    stringified = '알 수 없는 에러';
  }

  const error = new Error(`error : ${stringified}`);

  return new BaseError({
    name: '알 수 없는 에러',
    message: error.message,
    code: 500
  });
}
