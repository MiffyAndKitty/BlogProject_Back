import { newToken } from '../../utils/token/newToken';
import { MultipleDataResponse } from '../../interfaces/response';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { ensureError } from '../../errors/ensureError';
import { GoogleLoginUserDto } from '../../interfaces/GoogleLoginUser';

export const googleAuthService = async (
  user: GoogleLoginUserDto
): Promise<MultipleDataResponse<string>> => {
  try {
    const accessToken = newToken.access(user.id);
    const refreshToken = newToken.refresh();

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return {
        result: false,
        data: [],
        message: '토큰 발급 실패'
      };
    }

    // 유저의 refresh 토큰이 저장되어있다면 update, 아니라면 저장
    const savedRefresh = await setRefreshToken(user.id, refreshToken);

    return savedRefresh === 'OK' // savedRefresh에서 OK 혹은 err.name반환
      ? {
          result: true,
          data: [user.nickname, `Bearer%20${accessToken}`],
          message: '구글 로그인 성공'
        }
      : {
          result: false,
          data: [],
          message: savedRefresh || 'refresh토큰 저장 실패'
        };
  } catch (err) {
    const error = ensureError(err);
    console.log('구글 서비스 함수 오류 : ', error.message);
    return {
      result: false,
      data: [],
      message: '구글 로그인 중 서버 오류 ' + error
    };
  }
};
