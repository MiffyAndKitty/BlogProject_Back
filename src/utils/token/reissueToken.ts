import '../../config/env';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { newToken } from './newToken';
import { ensureError } from '../../errors/ensureError';
import { BasicResponse, MultipleDataResponse } from '../../interfaces/response';
import { getCachedToken } from '../redis/refreshToken';
import { InternalServerError } from '../../errors/internalServerError';
/*import { BadRequestError } from '../../errors/badRequestError';*/

// 토큰 유효성 검증 후 재발급
export async function reissueToken(
  accessToken: string
): Promise<BasicResponse | MultipleDataResponse<string>> {
  try {
    const decodedId = (jwt.decode(accessToken) as JwtPayload)?.id || null;

    if (!decodedId) throw new InternalServerError('access 토큰 decode 실패');

    // access토큰은 유효x -> refresh토큰이 유효-> 재발급
    const refreshToken = await getCachedToken(decodedId);

    // access토큰은 유효x -> refresh토큰이 유효x
    if (!refreshToken)
      throw new InternalServerError('유효하지 않은 refresh 토큰');
    /*throw new BadRequestError('유효하지 않은 refresh 토큰');*/

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
    throw ensureError(err, 'access 토큰 재발급 오류');
  }
}
