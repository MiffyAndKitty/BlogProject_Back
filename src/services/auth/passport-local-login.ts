import { newToken } from '../../utils/token/newToken';
import { conn } from '../../loaders/mariadb';
import { DataReturnType } from '../../interfaces';

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

    let savedRefresh = await conn.query(
      'UPDATE RefreshToken SET token = ? WHERE token_userid = ?;',
      [refreshToken, userid]
    );

    if (savedRefresh.affectedRows === 0) {
      savedRefresh = await conn.query(
        'INSERT INTO RefreshToken (token, token_userid) VALUES (?, ?)',
        [refreshToken, userid]
      );
    }

    return savedRefresh.affectedRows === 1
      ? { result: true, data: accessToken, message: '로그인 성공' }
      : { result: false, data: '', message: 'refresh 토큰 저장 실패' };
  } catch (err) {
    console.log(err);
    return {
      result: false,
      data: '',
      message: '로그인 실패, 서버 오류가 발생했습니다.'
    };
  }
};
