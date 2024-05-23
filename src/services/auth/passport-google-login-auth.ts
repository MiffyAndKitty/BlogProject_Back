import { newToken } from '../../utils/token/newToken';
import { conn } from '../../loaders/mariadb';
import { OAuthUserDto } from '../../dtos';
import { DataReturnType } from '../../interfaces';

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

    // new칼럼이 false이면 RefreshToken 테이블에 유저 데이터가 존재 O
    // new칼럼이 true이면 RefreshToken 테이블에 유저 데이터가 존재 X
    const query =
      user.new === false
        ? 'UPDATE RefreshToken SET token = ? WHERE token_userid = ?'
        : 'INSERT INTO RefreshToken (token, token_userid) VALUES (?, ?)';

    const savedRefresh = await conn.query(query, [refreshToken, user.id]);

    return savedRefresh.affectedRows === 1
      ? { result: true, data: accessToken, message: '구글 로그인 성공' }
      : {
          result: false,
          data: '',
          message: 'refresh 토큰 저장 실패'
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
