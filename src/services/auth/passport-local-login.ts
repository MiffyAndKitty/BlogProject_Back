import { newToken } from '../../utils/token/newToken';
import { DataReturnType } from '../../interfaces';
import { setRefreshToken } from '../../utils/redis/refreshToken';

export const localAuthService = async (
  userid: string
): Promise<DataReturnType> => {
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
    console.log(err);
    return {
      result: false,
      data: '',
      message: '로그인 실패, 서버 오류가 발생했습니다.'
    };
  }
};
