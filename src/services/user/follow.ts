import { db } from '../../loaders/mariadb';
import { UserInfoDto } from '../../interfaces/user/userInfo';
import { FollowListDto, topFollowerInfo } from '../../interfaces/user/follow';
import { SingleNotificationResponse } from '../../interfaces/response';
import { redis } from '../../loaders/redis';
import { LimitRequestDto } from '../../interfaces/limitRequestDto';
import { CacheKeys } from '../../constants/cacheKeys';
import {
  FollowedListUser,
  FollowingListUser
} from '../../interfaces/user/follow';
import { NotificationName } from '../../constants/notificationName';
import { FOLLOW_PAGESIZE_LIMIT } from '../../constants/pageSizeLimit';
import { TOP_FOLLOW_LIMIT } from '../../constants/cashedListSizeLimit';
import { NotFoundError } from '../../errors/notFoundError';
import { ConflictError } from '../../errors/conflictError';
import { BadRequestError } from '../../errors/badRequestError';
import { InternalServerError } from '../../errors/internalServerError';

export class FollowService {
  static getFollowList = async (followListDto: FollowListDto) => {
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

    if (!user)
      throw new NotFoundError('해당 이메일을 가진 유저가 존재하지 않습니다.');

    const thisUser = user.user_id;
    const currentUser = followListDto.userId;
    const pageSize = followListDto.pageSize || FOLLOW_PAGESIZE_LIMIT;
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
  };

  // 최다 팔로워 보유 블로거 리스트 조회
  static getTopFollowersList = async (limitRequestDto: LimitRequestDto) => {
    const followerLimit = limitRequestDto.limit || TOP_FOLLOW_LIMIT;
    const cachedTopFollowers = await redis.zrevrange(
      CacheKeys.TOP_FOLLOWERS,
      0,
      followerLimit - 1,
      'WITHSCORES'
    );

    if (!cachedTopFollowers || cachedTopFollowers.length === 0)
      throw new NotFoundError('최다 팔로워 보유 블로거 조회 실패');

    const topFollowersWithScores: any = [];
    const userIds = cachedTopFollowers.filter((_, index) => index % 2 === 0);
    const userInfos = await db.query(
      `
          SELECT user_id,user_nickname, user_image, deleted_at
          FROM User
          WHERE user_id IN (?)
        `,
      [userIds]
    );

    userInfos.forEach((userInfo: topFollowerInfo) => {
      const index = cachedTopFollowers.indexOf(userInfo.user_id);
      if (userInfo.deleted_at === null) {
        topFollowersWithScores.push({
          userName: userInfo.user_nickname,
          userImage: userInfo.user_image,
          score: Number(cachedTopFollowers[index + 1])
        });
      }
    });

    return {
      result: true,
      data: topFollowersWithScores,
      message: '최다 팔로워 보유 블로거 조회 성공'
    };
  };

  static addfollow = async (
    userInfoDto: UserInfoDto
  ): Promise<SingleNotificationResponse> => {
    // 먼저 팔로우하려는 사용자가 존재하는지 확인
    const [followedUser] = await db.query(
      `SELECT user_id, user_email, user_nickname, user_image FROM User WHERE user_email = ? AND deleted_at IS NULL;`,
      [userInfoDto.email]
    );

    if (!followedUser)
      throw new NotFoundError('팔로우할 유저를 찾을 수 없습니다.');

    const [currentUser] = await db.query(
      `SELECT user_id, user_email, user_nickname, user_image FROM User WHERE user_id = ? AND deleted_at IS NULL;`,
      [userInfoDto.userId]
    );

    if (followedUser.user_id === currentUser.user_id) {
      throw new BadRequestError('자기 자신을 팔로우할 수 없습니다.');
    }

    const values = [
      followedUser.user_id, // 팔로우하려는 사용자의 ID
      currentUser.user_id // 팔로우하는 사용자의 ID
    ];

    // 기존 팔로우 관계 확인
    const [existingFollow] = await db.query(
      `SELECT deleted_at FROM Follow WHERE followed_id = ? AND following_id = ?`,
      values
    );

    if (existingFollow && !existingFollow.deleted_at) {
      // 이미 팔로우된 경우
      throw new ConflictError('이미 팔로우한 유저입니다.');
    }

    let query: string;

    if (existingFollow) {
      // 기존 팔로우가 존재하고 soft delete 상태인 경우, deleted_at을 NULL로 업데이트
      query = `UPDATE Follow SET deleted_at = NULL WHERE followed_id = ? AND following_id = ?`;
    } else {
      // 새로운 팔로우 관계 추가
      query = `INSERT INTO Follow (followed_id, following_id) VALUES (?, ?)`;
    }

    const { affectedRows: addedCount } = await db.query(query, values);

    if (addedCount === 0) throw new InternalServerError('팔로우 추가 실패');

    return {
      result: true,
      message: existingFollow
        ? 'soft delete한 팔로우 복구 성공'
        : '팔로우 추가 성공',
      notifications: {
        recipient: followedUser.user_id,
        type: NotificationName.NEW_FOLLOWER,
        trigger: {
          id: currentUser.user_id,
          nickname: currentUser.user_nickname,
          email: currentUser.user_email,
          image: currentUser.user_image
        }
      }
    };
  };

  // 팔로우 취소
  static deletefollow = async (userInfoDto: UserInfoDto) => {
    // following하던 사람이 followed되던 사람을 팔로우 취소
    const [followedUser] = await db.query(
      `
        SELECT *
        FROM User
        WHERE user_email = ? AND deleted_at IS NULL LIMIT 1;
        `,
      [userInfoDto.email]
    );

    if (!followedUser)
      throw new NotFoundError('팔로우할 유저를 찾을 수 없습니다.');

    const followed = followedUser.user_id!;
    const currentUser = userInfoDto.userId; // 팔로워 (현재 유저)

    const query = `UPDATE Follow SET deleted_at = CURRENT_TIMESTAMP
                     WHERE followed_id = ? AND following_id = ? AND deleted_at IS NULL;
                  `;
    const values = [followed, currentUser];

    const { affectedRows: deletedCount } = await db.query(query, values);

    if (deletedCount === 0) throw new InternalServerError('팔로우 취소 실패');

    return { result: true, message: '팔로우 취소 성공' };
  };
}
