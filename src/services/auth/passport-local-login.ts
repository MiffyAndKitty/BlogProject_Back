import { newToken } from '../../utils/token/newToken';
import { MultipleUserDataResponse } from '../../interfaces/response';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { LoginServiceDto } from '../../interfaces/auth';
import { InternalServerError } from '../../errors/internalServerError';
export const localAuthService = async (
  user: LoginServiceDto
): Promise<MultipleUserDataResponse> => {
  const accessToken = newToken.access(user.userId);
  const refreshToken = newToken.refresh();

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new InternalServerError('토큰 발급 실패');
  }

  const savedRefresh = await setRefreshToken(user.userId, refreshToken);

  if (savedRefresh === 'OK') {
    // savedRefresh에서 OK 혹은 err.name반환
    return {
      result: true,
      data: { accessToken: accessToken, userEmail: user.userEmail },
      message: '로그인 성공'
    };
  }
  throw new InternalServerError(savedRefresh || 'refresh 토큰 저장 실패');
};
