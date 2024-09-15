export const ERROR_NAMES = {
  BAD_REQUEST: 'BadRequestError',
  UNAUTHORIZED: 'UnauthorizedError',
  FORBIDDEN: 'ForbiddenError',
  NOT_FOUND: 'NotFoundError',
  CONFLICT: 'ConflictError',
  INTERNAL_SERVER: 'InternalServerError'
} as const;

export const ERROR_MESSAGES = {
  BAD_REQUEST: '잘못된 요청입니다.',
  UNAUTHORIZED: '인증되지 않은 접근입니다.',
  FORBIDDEN: '이 리소스에 접근할 권한이 없습니다.',
  NOT_FOUND: '요청한 리소스를 찾을 수 없습니다.',
  CONFLICT: '리소스의 현재 상태와 충돌하여 요청을 완료할 수 없습니다.',
  INTERNAL_SERVER: '서버 내부 오류가 발생했습니다.'
} as const;

export const ERROR_CODES = {
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER: 500
} as const;
