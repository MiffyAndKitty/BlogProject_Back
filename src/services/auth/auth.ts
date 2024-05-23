import { db } from '../../loaders/mariadb';
import { getHashed } from '../../utils/getHashed';
import { UserDto } from '../../dtos';
import { ensureError } from '../../errors/ensureError';

export class AuthService {
  static deleteToken = async (userid: string) => {
    try {
      const deleted = await db.query(
        'DELETE FROM RefreshToken WHERE token_userid=?;',
        userid
      );
      if (deleted.affectedRows === 1) {
        return { result: true, message: '로그아웃 성공' };
      } else {
        const message =
          deleted.affectedRows === 0
            ? '유효한 access 토큰, 존재하지 않는 refresh 토큰'
            : '비정상적으로 많은 갯수의 refresh 토큰을 삭제';
        return {
          result: false,
          message: message
        };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static saveUser = async (userDto: UserDto) => {
    try {
      const hashed = await getHashed(userDto.password);

      const saved = await db.query(
        'INSERT INTO User (user_email, user_password, user_nickname) VALUES (?, ?, ?)',
        [userDto.email, hashed, userDto.nickname]
      );

      if (saved.affectedRows === 1) {
        return { result: true, message: '회원 정보 저장 성공' };
      } else {
        return { result: false, message: '회원 정보 저장 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
