import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { UserInfoDto } from '../../interfaces/user/userInfo';
export class FollowService {
  static getfollowList = async (userInfoDto: UserInfoDto) => {
    try {
      // userId는 현재 이 리스트를 조회하는 사용자의 id
      // nickname은 follow 리스트 조회 대상
      const [user] = await db.query(
        // nickname를 팔로우하는 유저들
        `
        SELECT *
        FROM User
        WHERE user_nickname = ? AND deleted_at IS NULL LIMIT 1;
        `,
        [userInfoDto.nickname]
      );

      const userIdOfNickname = user.user_id;

      const followingList = await db.query(
        // nickname이 팔로우하는 유저들
        `
        SELECT DISTINCT f.followed_id , u.user_nickname
        FROM Follow f
        JOIN User u ON f.followed_id = u.user_id
        WHERE following_id = ?;
        `,
        [userIdOfNickname]
      );

      const followedList = await db.query(
        `
        SELECT DISTINCT f.following_id , u.user_nickname
        FROM Follow f
        JOIN User u ON f.following_id = u.user_id
        WHERE followed_id = ?;
        `,
        [userIdOfNickname]
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
      const query = `
        INSERT INTO Follow (followed_id, following_id)
        SELECT ?, u.user_id
        FROM User u
        WHERE u.user_id != ? AND u.user_nickname = ? AND deleted_at IS NULL;
      `;

      const values = [
        userInfoDto.userId, // `followed_id`: 현재 사용자가 팔로우하고자 하는 유저의 ID
        userInfoDto.userId, // 현재 사용자의 ID를 `!=` 조건에 사용하여 자기 자신을 팔로우하지 못하도록 함
        userInfoDto.nickname // 팔로우할 유저의 닉네임
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
      const [following] = await db.query(
        // nickname를 팔로우하는 유저
        `
        SELECT *
        FROM User
        WHERE user_nickname = ? AND deleted_at IS NULL LIMIT 1;
        `,
        [userInfoDto.nickname]
      );

      const query = `
                    UPDATE Follow
                    SET deleted_at = CURRENT_TIMESTAMP
                    WHERE followed_id = ? 
                      AND following_id = ?
                      AND deleted_at IS NULL;
                  `;
      const values = [userInfoDto.userId, following.user_id];

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
