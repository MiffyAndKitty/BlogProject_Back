export function verifyTokenError(err: unknown): Error {
  if (!(err instanceof Error)) {
    let stringified = '에러값을 문자열화 실패';
    try {
      stringified = JSON.stringify(err);
    } catch {}

    const error = new Error(`error : ${stringified}`);
    return error;
  } else {
    if (err.name === 'TokenExpiredError') {
      err.message = '만료된 토큰';
    } else if (err.name === 'JsonWebTokenError') {
      err.message = '유효하지 않은 토큰';
    } else if (err.name === 'TypeError') {
      err.message = '잘못된 타입의 토큰';
    }
    return err;
  }
}
