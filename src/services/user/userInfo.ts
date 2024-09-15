import { db } from '../../loaders/mariadb';
import { DbColumnDto } from '../../interfaces/dbColumn';
import {
  UserEmailLookupDto,
  UserNicknameLookupDto,
  UserProfileDto,
  UserPwDto
} from '../../interfaces/user/userInfo';
import { getHashed } from '../../utils/getHashed';
import { comparePw } from '../../utils/comparePassword';
import { NotFoundError } from '../../errors/notFoundError';
import { ConflictError } from '../../errors/conflictError';
import { InternalServerError } from '../../errors/internalServerError';
import { BadRequestError } from '../../errors/badRequestError';

export class UsersService {
  static isDuplicated = async (existDto: DbColumnDto) => {
    const query = `SELECT * FROM User WHERE ${existDto.column} = ?;`;
    const values = [existDto.data];
    const rows = await db.query(query, values);

    if (rows.length !== 0) {
      throw new BadRequestError('이미 사용 중인 데이터입니다.');
      //throw new ConflictError('이미 사용 중인 데이터입니다.');
    }

    return { result: true, message: '사용 가능한 데이터' };
  };

  static checkDuplicatePassword = async (userPwDto: UserPwDto) => {
    const query = `SELECT user_password FROM User WHERE user_id = ? AND deleted_at IS NULL;`;
    const values = [userPwDto.userId];
    const [user] = await db.query(query, values);

    const isMatch = await comparePw(userPwDto.password, user.user_password);

    if (isMatch === true) {
      return { result: true, message: '비밀번호 일치' };
    }
    throw new BadRequestError('비밀번호가 일치하지 않습니다.');
  };

  static getUserInfoByEmail = async (
    userEmailLookupDto: UserEmailLookupDto
  ) => {
    const query = `SELECT * FROM User WHERE user_email = ? AND  deleted_at IS NULL LIMIT 1;`;
    const values = [userEmailLookupDto.email];
    const [userInfo] = await db.query(query, values);

    if (!userInfo) throw new NotFoundError('존재하지 않는 사용자');

    userInfo.isSelf = false;
    if (userInfo.user_id === userEmailLookupDto.userId) {
      userInfo.isSelf = true;
    }

    const currentUser = userEmailLookupDto.userId;
    const thisUser = userInfo.user_id;

    const followQuery = `
        SELECT 
          EXISTS (
            SELECT 1 
            FROM Follow 
            WHERE followed_id = ? AND following_id = ? AND deleted_at IS NULL
          ) AS areYouFollowed,
          EXISTS (
            SELECT 1 
            FROM Follow 
            WHERE followed_id = ? AND following_id = ? AND deleted_at IS NULL
          ) AS areYouFollowing
      `;
    const followValues = [currentUser, thisUser, thisUser, currentUser];

    const [confirmedFollow]: [
      { areYouFollowed: 0 | 1; areYouFollowing: 0 | 1 }
    ] = await db.query(followQuery, followValues);

    userInfo.areYouFollowed = !!confirmedFollow.areYouFollowed;
    userInfo.areYouFollowing = !!confirmedFollow.areYouFollowing;

    return {
      result: true,
      data: userInfo,
      message: '이메일을 이용하여 사용자의 상세 데이터 반환 성공'
    };
  };

  static getUserInfoByNickname = async (
    userNicknameLookupDto: UserNicknameLookupDto
  ) => {
    const query = `SELECT user_email, user_image, user_message, deleted_at FROM User WHERE user_nickname = ? LIMIT 1;`;
    const params = [decodeURIComponent(userNicknameLookupDto.nickname)];

    const [userInfo] = await db.query(query, params);

    if (!userInfo) throw new NotFoundError('존재하지 않는 회원입니다.');

    if (userInfo.deleted_at) throw new NotFoundError('탈퇴한 회원입니다');

    return {
      result: true,
      data: userInfo,
      message: '닉네임을 이용하여 사용자의 기본 데이터 반환 성공'
    };
  };

  static modifyUserProfile = async (userProfileDto: UserProfileDto) => {
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

    if (updatedCount === 0) {
      throw new InternalServerError('사용자 데이터 업데이트 실패');
    }
    return {
      result: true,
      message: '사용자 데이터 업데이트 성공'
    };
  };
}
