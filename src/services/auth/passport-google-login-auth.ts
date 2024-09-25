import { newToken } from '../../utils/token/newToken';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { MultipleUserDataResponse } from '../../interfaces/response';
import { GoogleLoginServiceDto } from '../../interfaces/auth';
import { InternalServerError } from '../../errors/internalServerError';
import { CacheKeys } from '../../constants/cacheKeys';
export const googleAuthService = async (
  user: GoogleLoginServiceDto
): Promise<MultipleUserDataResponse> => {
  const accessToken = newToken.access(user.userId);
  const refreshToken = newToken.refresh();

  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new InternalServerError('토큰 발급 실패');
  }

  // 유저의 refresh 토큰이 저장되어있다면 update, 아니라면 저장
  const savedRefresh = await setRefreshToken(user.userId, refreshToken);
  const savedGoogleAccess = await setRefreshToken(
    user.userId,
    user.accessToken,
    CacheKeys.GOOGLE_ACCESSTOKEN
  );

  if (savedRefresh === 'OK' && savedGoogleAccess === 'OK') {
    // savedRefresh에서 OK 혹은 err.name반환
    return {
      result: true,
      data: {
        accessToken: `Bearer%20${accessToken}`,
        userEmail: user.userEmail
      },
      message: '구글 로그인 성공'
    };
  }
  throw new InternalServerError(
    `refresh토큰 저장 실패 : ${savedRefresh}, 구글 access토큰 저장 실패 : ${savedGoogleAccess}`
  );
};
