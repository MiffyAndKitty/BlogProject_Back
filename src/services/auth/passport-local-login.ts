import { newToken } from '../../utils/token/newToken';
import { MultipleUserDataResponse } from '../../interfaces/response';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { ensureError } from '../../errors/ensureError';
import { LoginServiceDto } from '../../interfaces/auth';
export const localAuthService = async (
  user: LoginServiceDto
): Promise<MultipleUserDataResponse> => {
  const accessToken = newToken.access(user.userId);
  const refreshToken = newToken.refresh();

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    return {
      result: false,
      data: { accessToken: undefined, userEmail: undefined },
      message: '토큰 발급 실패'
    };
  }

  const savedRefresh = await setRefreshToken(user.userId, refreshToken);

  return savedRefresh === 'OK' // savedRefresh에서 OK 혹은 err.name반환
    ? {
        result: true,
        data: { accessToken: accessToken, userEmail: user.userEmail },
        message: '로그인 성공'
      }
    : {
        result: false,
        data: { accessToken: undefined, userEmail: undefined },
        message: savedRefresh || 'refresh 토큰 저장 실패'
      };
};
