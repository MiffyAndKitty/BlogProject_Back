import { newToken } from '../../utils/token/newToken';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { ensureError } from '../../errors/ensureError';
import { MultipleUserDataResponse } from '../../interfaces/response';
import { LoginServiceDto } from '../../interfaces/auth';
export const googleAuthService = async (
  user: LoginServiceDto
): Promise<MultipleUserDataResponse> => {
  const accessToken = newToken.access(user.userId);
  const refreshToken = newToken.refresh();

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    return {
      result: false,
      data: {},
      message: '토큰 발급 실패'
    };
  }

  // 유저의 refresh 토큰이 저장되어있다면 update, 아니라면 저장
  const savedRefresh = await setRefreshToken(user.userId, refreshToken);

  return savedRefresh === 'OK' // savedRefresh에서 OK 혹은 err.name반환
    ? {
        result: true,
        data: {
          accessToken: `Bearer%20${accessToken}`,
          userEmail: user.userEmail
        },
        message: '구글 로그인 성공'
      }
    : {
        result: false,
        data: {},
        message: savedRefresh || 'refresh토큰 저장 실패'
      };
};
