import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { UserInfoDto } from '../../interfaces/user/userInfo';
import { FollowListDto } from '../../interfaces/user/userInfo';
import { NotificationResponse } from '../../interfaces/response';

export class FollowService {
  static getFollowList = async (followListDto: FollowListDto) => {
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
        [followListDto.email]
      );

      if (!user) {
        return {
          result: false,
          data: [],
          message: '해당 이메일을 가진 유저가 존재하지 않습니다.'
        };
      }

      const thisUser = user.user_id;
      const currentUser = followListDto.userId;
      const pageSize = followListDto.pageSize || 10;
      const offset = (followListDto.page - 1) * pageSize;

      const followingsList: FollowingListUser[] = await db.query(
        `
      SELECT DISTINCT f.followed_id, u.user_nickname, u.user_email, u.user_image, 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Follow WHERE following_id = ? AND followed_id = f.followed_id AND deleted_at IS NULL
          ) THEN true
          ELSE false
        END AS areYouFollowing,
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Follow WHERE followed_id = ? AND following_id = f.followed_id AND deleted_at IS NULL
          ) THEN true 
          ELSE false
        END AS areYouFollowed
      FROM Follow f
      JOIN User u ON f.followed_id = u.user_id
      WHERE f.following_id = ? AND f.deleted_at IS NULL AND u.deleted_at IS NULL
      LIMIT ? OFFSET ?;
      `,
        [currentUser, currentUser, thisUser, pageSize, offset]
      );

      const followersList: FollowedListUser[] = await db.query(
        `
      SELECT DISTINCT f.following_id, u.user_nickname, u.user_email, u.user_image, 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Follow WHERE following_id = ? AND followed_id = f.following_id AND deleted_at IS NULL
          ) THEN true
          ELSE false
        END AS areYouFollowing, 
        CASE 
          WHEN EXISTS (
            SELECT 1 FROM Follow WHERE followed_id = ? AND following_id = f.following_id AND deleted_at IS NULL
          ) THEN true 
          ELSE false
        END AS areYouFollowed
      FROM Follow f
      JOIN User u ON f.following_id = u.user_id
      WHERE f.followed_id = ? AND f.deleted_at IS NULL AND u.deleted_at IS NULL
      LIMIT ? OFFSET ?;
      `,
        [currentUser, currentUser, thisUser, pageSize, offset]
      );

      // 상호 팔로우 목록 생성
      const mutualFollowList = followingsList
        .filter((followingUser: FollowingListUser) =>
          followersList.some(
            (followedUser: FollowedListUser) =>
              followingUser.followed_id === followedUser.following_id
          )
        )
        .map((user: FollowingListUser) => {
          const { followed_id, ...rest } = user;
          return {
            mutual_id: followed_id,
            ...rest
          };
        });

      return {
        result: true,
        data: {
          followingsList: followingsList, // 유저가 팔로우하는 유저 목록
          followersList: followersList, // 유저를 팔로우하는 팔로워 유저 목록
          mutualFollowList: mutualFollowList // 상호 팔로우 목록
        },
        message: '유저의 팔로우/팔로워 목록 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static addfollow = async (
    userInfoDto: UserInfoDto
  ): Promise<NotificationResponse> => {
    try {
      // 먼저 팔로우하려는 사용자가 존재하는지 확인
      const [followedUser] = await db.query(
        `SELECT user_id FROM User WHERE user_email = ? AND deleted_at IS NULL;`,
        [userInfoDto.email]
      );

      if (!followedUser)
        return {
          result: false,
          message: '팔로우할 유저를 찾을 수 없습니다.'
        };

      const currentUser = userInfoDto.userId!;
      const followed = followedUser.user_id!;

      if (followed === currentUser)
        return { result: false, message: '자기 자신을 팔로우할 수 없습니다.' };

      const values = [
        followed, // 팔로우하려는 사용자의 ID
        currentUser // 팔로우하는 사용자의 ID
      ];

      const { affectedRows: addedCount } = await db.query(
        `INSERT INTO Follow (followed_id, following_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE deleted_at = NULL;`,
        values
      );

      if (addedCount > 0) {
        return {
          result: true,
          message:
            addedCount === 1
              ? '팔로우 추가 성공'
              : 'soft delete한 팔로우 복구 성공',
          notifications: {
            recipient: followed,
            trigger: currentUser,
            type: 'new-follower'
          }
        };
      }

      return {
        result: false,
        message: '팔로우 추가 실패 (ex. 이미 팔로우된 유저)'
      };
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
