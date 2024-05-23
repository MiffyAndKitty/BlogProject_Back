export function ensureError(err: unknown): Error {
  if (err instanceof Error) return err;

  let stringified = '에러값 문자열화 실패';
  try {
    stringified = JSON.stringify(err);
  } catch {}

  const error = new Error(`error : ${stringified}`);
  return error;
}
