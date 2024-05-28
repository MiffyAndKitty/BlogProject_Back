import { newToken } from '../../utils/token/newToken';
import { OAuthUserDto } from '../../dtos';
import { DataReturnType } from '../../interfaces';
import { setRefreshToken } from '../../utils/redis/refreshToken';

export const googleAuthService = async (
  user: OAuthUserDto
): Promise<DataReturnType> => {
  try {
    const accessToken = newToken.access(user.id);
    const refreshToken = newToken.refresh();

    if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
      return {
        result: false,
        data: '',
        message: '토큰 발급 실패'
      };
    }

    // 유저의 refresh 토큰이 저장되어있다면 update, 아니라면 저장
    const savedRefresh = await setRefreshToken(user.id, refreshToken);

    return savedRefresh === 'OK' // savedRefresh에서 OK 혹은 err.name반환
      ? { result: true, data: accessToken, message: '구글 로그인 성공' }
      : {
          result: false,
          data: '',
          message: savedRefresh || 'refresh토큰 저장 실패'
        };
  } catch (err: unknown) {
    console.log(err);
    return {
      result: false,
      data: '',
      message: '구글 로그인 실패, 서버 오류가 발생했습니다.'
    };
  }
};
