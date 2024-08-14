import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { UserInfoDto } from '../../interfaces/user/userInfo';
export class FollowService {
  static getfollowList = async (userInfoDto: UserInfoDto) => {
    try {
      // userId는 현재 이 리스트를 조회하는 사용자의 id
      // email을 가진 사용자는 follow 리스트 조회 대상
      const [user] = await db.query(
        // email을 가진 사용자를 팔로우하는 유저들
        `
        SELECT *
        FROM User
        WHERE user_email = ? AND deleted_at IS NULL LIMIT 1;
        `,
        [userInfoDto.email]
      );

      const userIdOfEmail = user.user_id;

      const followingList = await db.query(
        // email을 가진 사용자가 팔로우하는 유저들
        `
        SELECT DISTINCT f.followed_id , u.user_nickname, u.user_email
        FROM Follow f
        JOIN User u ON f.followed_id = u.user_id
        WHERE following_id = ?;
        `,
        [userIdOfEmail]
      );

      const followedList = await db.query(
        `
        SELECT DISTINCT f.following_id , u.user_nickname, u.user_email
        FROM Follow f
        JOIN User u ON f.following_id = u.user_id
        WHERE followed_id = ?;
        `,
        [userIdOfEmail]
      );

      return {
        result: true,
        data: { followingList: followingList, followedList: followedList },
        message: '사용 가능한 데이터'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static addfollow = async (userInfoDto: UserInfoDto) => {
    try {
      // 먼저 팔로우하려는 사용자가 존재하는지 확인
      const followedQuery = `SELECT user_id FROM User WHERE user_email = ? AND deleted_at IS NULL;`;

      const [followedUser] = await db.query(followedQuery, [userInfoDto.email]);

      if (!followedUser) {
        return { result: false, message: '팔로우할 유저를 찾을 수 없습니다.' };
      }

      const followed = followedUser.user_id!;
      const currentUser = userInfoDto.userId;

      if (followed === currentUser) {
        return { result: false, message: '자기 자신을 팔로우할 수 없습니다.' };
      }
      const query = `INSERT INTO Follow (followed_id, following_id) VALUES (?, ?)`;

      const values = [
        followed, // 팔로우하려는 사용자의 ID
        currentUser // 팔로우하는 사용자의 ID
      ];

      const { affectedRows: addedCount } = await db.query(query, values);

      if (addedCount === 1) {
        return { result: true, message: '팔로우 추가 성공' };
      } else {
        return { result: false, message: '팔로우 추가 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  // 팔로우 취소
  static deletefollow = async (userInfoDto: UserInfoDto) => {
    try {
      // following하던 사람이 followed되던 사람을 팔로우 취소
      const [followedUser] = await db.query(
        // 팔로우 하던 사람
        `
        SELECT *
        FROM User
        WHERE user_email = ? AND deleted_at IS NULL LIMIT 1;
        `,
        [userInfoDto.email]
      );

      if (!followedUser) {
        return { result: false, message: '팔로우할 유저를 찾을 수 없습니다.' };
      }

      const followed = followedUser.user_id!;
      const currentUser = userInfoDto.userId; // following하던 사람

      const query = `UPDATE Follow SET deleted_at = CURRENT_TIMESTAMP
                     WHERE followed_id = ? AND following_id = ? AND deleted_at IS NULL;
                  `;
      const values = [followed, currentUser];

      const { affectedRows: deletedCount } = await db.query(query, values);

      return deletedCount === 1
        ? { result: true, message: '팔로우 취소 성공' }
        : { result: false, message: '팔로우 취소 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
