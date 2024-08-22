import { newToken } from '../../utils/token/newToken';
import { MultipleDataResponse } from '../../interfaces/response';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { ensureError } from '../../errors/ensureError';

export const localAuthService = async (
  user: Array<string>
): Promise<MultipleDataResponse<string>> => {
  try {
    const accessToken = newToken.access(user[0]); // usernickname
    const refreshToken = newToken.refresh();

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return {
        result: false,
        data: [],
        message: '토큰 발급 실패'
      };
    }

    const savedRefresh = await setRefreshToken(user[0], refreshToken);

    return savedRefresh === 'OK' // savedRefresh에서 OK 혹은 err.name반환
      ? { result: true, data: [accessToken, user[1]], message: '로그인 성공' } //user[1] : usernickname
      : {
          result: false,
          data: [],
          message: savedRefresh || 'refresh 토큰 저장 실패'
        };
  } catch (err) {
    const error = ensureError(err);
    console.log('로컬 서비스 함수 오류 : ', error.message);
    return {
      result: false,
      data: [],
      message: '로컬 로그인 중 서버 오류 ' + error
    };
  }
};
