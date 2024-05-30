import { newToken } from '../../utils/token/newToken';
import { SingleDataResponse } from '../../interfaces/response';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { ensureError } from '../../errors/ensureError';

export const localAuthService = async (
  userid: string
): Promise<SingleDataResponse> => {
  try {
    const accessToken = newToken.access(userid);
    const refreshToken = newToken.refresh();

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return {
        result: false,
        data: '',
        message: '토큰 발급 실패'
      };
    }

    const savedRefresh = await setRefreshToken(userid, refreshToken);

    return savedRefresh === 'OK' // savedRefresh에서 OK 혹은 err.name반환
      ? { result: true, data: accessToken, message: '로그인 성공' }
      : {
          result: false,
          data: '',
          message: savedRefresh || 'refresh 토큰 저장 실패'
        };
  } catch (err) {
    const error = ensureError(err);
    console.log('로컬 서비스 함수 오류 : ', error.message);
    return {
      result: false,
      data: '',
      message: '로컬 로그인 중 서버 오류 ' + error
    };
  }
};
