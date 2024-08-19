import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { UserInfoDto } from '../../interfaces/user/userInfo';
import { FollowListDto } from '../../interfaces/user/userInfo';
import { NotificationResponse } from '../../interfaces/response';

export class FollowService {
  static getFollowList = async (followListDto: FollowListDto) => {
    try {
      const [user] = await db.query(
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
    let followed: string = '';
    const currentUser = userInfoDto.userId!;
    try {
      // 먼저 팔로우하려는 사용자가 존재하는지 확인
      const followedQuery = `SELECT user_id FROM User WHERE user_email = ? AND deleted_at IS NULL;`;

      const [followedUser] = await db.query(followedQuery, [userInfoDto.email]);

      if (!followedUser) {
        return {
          result: false,
          message: '팔로우할 유저를 찾을 수 없습니다.'
        };
      }

      followed = followedUser.user_id!;

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
        // 팔로우 성공 후 알림 생성
        return {
          result: true,
          message: '팔로우 추가 성공',
          notifications: {
            recipient: followed,
            trigger: currentUser,
            type: 'new-follower'
          }
        };
      } else {
        return { result: false, message: '데이터베이스에 팔로우 저장 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      if ('errno' in error && error.errno === 1062) {
        return await FollowService._restoreFollow(followed, currentUser);
      }
      return { result: false, message: error.message };
    }
  };

  private static _restoreFollow = async (
    followedId: string,
    followingId: string
  ): Promise<NotificationResponse> => {
    try {
      const query = `UPDATE Follow 
               SET deleted_at = NULL 
               WHERE followed_id = ? AND following_id = ? AND deleted_at IS NOT NULL;`;

      const values = [
        followedId, // 팔로우하려는 사용자의 ID
        followingId // 팔로우하는 사용자의 ID
      ];

      const { affectedRows: restoredCount } = await db.query(query, values);

      if (restoredCount === 1) {
        return {
          result: true,
          notifications: {
            recipient: followedId,
            trigger: followingId,
            type: 'new-follower'
          },
          message: '삭제했던 팔로우 복구 성공'
        };
      }

      const [alreadyFollowed] = await db.query(
        `SELECT 1 FROM Follow WHERE followed_id = ? AND following_id = ? AND deleted_at IS NULL;`,
        values
      );

      return alreadyFollowed
        ? { result: false, message: '이미 팔로우된 유저' }
        : { result: false, message: '팔로우 실패' };
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
