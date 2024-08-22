import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { UserInfoDto } from '../../interfaces/user/userInfo';
export class FollowService {
  static getfollowList = async (userInfoDto: UserInfoDto) => {
    try {
      const [user] = await db.query(
        `
        SELECT *
        FROM User
        WHERE user_email = ? AND deleted_at IS NULL LIMIT 1;
        `,
        [userInfoDto.email]
      );

      if (!user) {
        return {
          result: false,
          data: [],
          message: '해당 이메일을 가진 유저가 존재하지 않습니다.'
        };
      }

      const thisUser = user.user_id;
      const currentUser = userInfoDto.userId;

      const followingList: FollowingListUser[] = await db.query(
        // 유저가 팔로우하는(following) 유저, followed_id를 속성으로 가짐
        // following : 팔로우 되는 사람
        // followed : 팔로우 하는 사람
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
        WHERE f.following_id = ? AND f.deleted_at IS NULL AND u.deleted_at IS NULL;
        `,
        [currentUser, currentUser, thisUser]
      );

      const followedList: FollowedListUser[] = await db.query(
        // 유저가 팔로우되는(followed) 유저, following_id를 속성으로 가짐
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
        WHERE f.followed_id = ? AND f.deleted_at IS NULL AND u.deleted_at IS NULL;
        `,
        [currentUser, currentUser, thisUser]
      );

      const mutualFollowList = followingList
        .filter((followingUser: FollowingListUser) =>
          followedList.some(
            (followedUser: FollowedListUser) =>
              followingUser.followed_id === followedUser.following_id
          )
        )
        .map((user: FollowingListUser) => {
          const { followed_id, ...rest } = user; // followed_id를 rest에서 제거
          return {
            mutual_id: followed_id, // mutual_id로 설정
            ...rest // 나머지 속성 복사
          };
        });

      return {
        result: true,
        data: {
          followingsList: followingList, // 유저가 팔로우하는(following) 유저, followed_id를 속성으로 가짐
          followersList: followedList, // 유저가 팔로우되는(followed) 유저, following_id를 속성으로 가짐
          mutualFollowList: mutualFollowList
        },
        message: '유저의 팔로우/팔로워 목록 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static addfollow = async (userInfoDto: UserInfoDto) => {
    let followed: string = '';
    const currentUser = userInfoDto.userId!;
    try {
      // 먼저 팔로우하려는 사용자가 존재하는지 확인
      const followedQuery = `SELECT user_id FROM User WHERE user_email = ? AND deleted_at IS NULL;`;

      const [followedUser] = await db.query(followedQuery, [userInfoDto.email]);

      if (!followedUser) {
        return { result: false, message: '팔로우할 유저를 찾을 수 없습니다.' };
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
        return { result: true, message: '팔로우 추가 성공' };
      } else {
        return { result: false, message: '팔로우 추가 실패' };
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
  ) => {
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
        return { result: true, message: '삭제했던 팔로우 복구 성공' };
      } else {
        const [alreadyFollow] = await db.query(
          `SELECT 1 FROM Follow WHERE followed_id = ? AND following_id = ? AND deleted_at IS NULL;`,
          values
        );
        console.log('alreadyFollow : ', alreadyFollow);
        return alreadyFollow
          ? { result: false, message: '이미 팔로우된 유저' }
          : { result: false, message: '팔로우 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error);

      return { result: false, message: error };
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
