import '../../config/env';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { newToken } from './newToken';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse, MultipleDataResponse } from '../../interfaces/response';
import { getRefreshToken } from '../redis/refreshToken';

// 토큰 유효성 검증 후 재발급
export async function reissueToken(
  accessToken: string
): Promise<BasicResponse | MultipleDataResponse<string>> {
  try {
    const decodedId = (jwt.decode(accessToken) as JwtPayload)?.id || null;

    if (!decodedId)
      return { result: false, message: 'access 토큰 decode 실패' };

    // access토큰은 유효x -> refresh토큰이 유효-> 재발급
    const refreshToken = await getRefreshToken(decodedId);

    // access토큰은 유효x -> refresh토큰이 유효x
    if (!refreshToken)
      return { result: false, message: '유효하지 않은 refresh 토큰' };

    // access토큰은 유효x-> refresh토큰이 유효-> 재발급
    const userId: string = decodedId;
    const newAccessToken = newToken.access(decodedId);

    if (typeof newAccessToken === 'string') {
      return {
        result: true,
        data: [userId, newAccessToken],
        message: 'access 토큰 재발급 성공'
      };
    }
    return { result: false, message: 'access 토큰 재발급 실패' };
  } catch (err) {
    const error = ensureError(err);
    console.log('토큰 재발급 함수 오류 :', error.message);
    return { result: false, message: error.message };
  }
}
