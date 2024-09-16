import { newToken } from '../../utils/token/newToken';
import { setRefreshToken } from '../../utils/redis/refreshToken';
import { MultipleUserDataResponse } from '../../interfaces/response';
import { GoogleLoginServiceDto } from '../../interfaces/auth';
import { InternalServerError } from '../../errors/internalServerError';
export const googleAuthService = async (
  user: GoogleLoginServiceDto
): Promise<MultipleUserDataResponse> => {
  const accessToken = newToken.access(user.userId);
  const refreshToken = newToken.refresh();
  console.log(user);
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    throw new InternalServerError('토큰 발급 실패');
  }

  // 유저의 refresh 토큰이 저장되어있다면 update, 아니라면 저장
  const savedRefresh = await setRefreshToken(user.userId, refreshToken);

  if (savedRefresh !== 'OK') {
    // savedRefresh에서 OK 혹은 err.name반환
    throw new InternalServerError(`refresh토큰 저장 실패 : ${savedRefresh}`);
  }
  console.log('구글 리프레시 토큰 설정 : ', user.refreshToken);
  const saveGoogleRefresh = await setRefreshToken(
    user.userId,
    user.refreshToken,
    true
  );
  console.log(
    '구글 리프레시 토큰 설정 saveGoogleRefresh : ',
    saveGoogleRefresh
  );
  if (saveGoogleRefresh !== 'OK') {
    throw new InternalServerError(
      `google-refresh토큰 저장 실패 : ${savedRefresh}`
    );
  }

  return {
    result: true,
    data: {
      accessToken: `Bearer%20${accessToken}`,
      userEmail: user.userEmail
    },
    message: '구글 로그인 성공'
  };
};
