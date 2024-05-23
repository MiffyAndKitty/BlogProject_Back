import 'dotenv/config';
import jwt from 'jsonwebtoken';
import { newToken } from './newToken';
import { db } from '../../loaders/mariadb';
import { verifyToken } from './verifyToken';
import { isPayload } from '../typegard/isPayload';
import { ensureError } from '../../errors/ensureError';
import { BasicReturnType, DatasReturnType } from '../../interfaces';

// 토큰 유효성 검증 후 재발급
export async function reissueToken(
  accessToken: string
): Promise<BasicReturnType | DatasReturnType<string>> {
  try {
    const decodedToken = jwt.decode(accessToken); // 디코드된 값 혹은 null을 반환

    if (!isPayload(decodedToken))
      return { result: false, message: '토큰 decode 실패' };

    // access토큰은 유효x -> refresh토큰이 유효->재발급
    const refreshToken = await db.query(
      'SELECT * FROM RefreshToken WHERE token_userid = ? LIMIT 1',
      decodedToken.id
    );
    const refreshPayload = verifyToken.refresh(refreshToken);

    // access토큰은 유효x -> refresh토큰이 유효x
    if (!isPayload(refreshPayload))
      return { result: false, message: 'refresh 토큰 유효하지 않음' };

    // access토큰은 유효x-> refresh토큰이 유효-> 재발급
    const userId: string = decodedToken.id;
    const newAccessToken = newToken.access(decodedToken.id);

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
    console.log(error.message);
    return { result: false, message: error.message };
  }
}
