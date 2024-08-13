import { db } from '../../loaders/mariadb';
import { DbColumnDto } from '../../interfaces/dbColumn';
import { ensureError } from '../../errors/ensureError';
import { UserInfoDto, UserProfileDto } from '../../interfaces/user/userInfo';
import { getHashed } from '../../utils/getHashed';
export class UsersService {
  static isDuplicated = async (existDto: DbColumnDto) => {
    try {
      if (existDto.column === 'user_password') {
        existDto.data = await getHashed(existDto.data);
      }
      const query = `SELECT * FROM User WHERE ${existDto.column} = ? ;`;
      const values = [existDto.data];
      const rows = await db.query(query, values);

      if (rows.length === 0) {
        return { result: true, message: '사용 가능한 데이터' };
      } else {
        return { result: false, message: '이미 사용 중인 데이터' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static getUserInfo = async (userInfoDto: UserInfoDto) => {
    try {
      const query = `SELECT * FROM User WHERE user_nickname = ? AND  deleted_at IS NULL LIMIT 1;`;
      const values = [decodeURIComponent(userInfoDto.nickname)];
      const [userInfo] = await db.query(query, values);

      if (!userInfo)
        return { result: false, data: [], message: '존재하지 않는 사용자' };

      userInfo.isSelf = false;
      if (userInfo.user_id === userInfoDto.userId) {
        userInfo.isSelf = true;
      }

      return {
        result: true,
        data: userInfo,
        message: '사용자 데이터 반환 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
    }
  };
  static modifyUserProfile = async (userProfileDto: UserProfileDto) => {
    try {
      let query = `UPDATE User SET `;
      const values = [];
      const setClauses = [];

      if (userProfileDto.nickname) {
        setClauses.push(`user_nickname = ?`);
        values.push(userProfileDto.nickname);
      }

      if (userProfileDto.statusMessage) {
        setClauses.push(`user_message = ?`);
        values.push(userProfileDto.statusMessage);
      }

      if (userProfileDto.profilePicture) {
        setClauses.push(`user_image = ?`);
        values.push(userProfileDto.profilePicture);
      }

      if (userProfileDto.password) {
        const hashed = await getHashed(userProfileDto.password);
        setClauses.push(`user_password = ?`);
        values.push(hashed);
      }
      query += setClauses.join(', ');
      query += ` WHERE user_id = ? AND deleted_at IS NULL `;
      values.push(userProfileDto.userId);

      const { affectedRows: updatedCount } = await db.query(query, values);

      return updatedCount === 1
        ? {
            result: true,
            message: '사용자 데이터 업데이트 성공'
          }
        : {
            result: false,
            message: '사용자 데이터 업데이트 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
