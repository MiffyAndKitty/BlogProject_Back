interface FollowListUser {
  user_nickname: string;
  user_email: string;
  user_image: string;
  IsFollowingThisUser: number;
  IsFollowedMe: number;
}

export interface FollowedListUser extends FollowListUser {
  following_id: string;
}

export interface FollowingListUser extends FollowListUser {
  followed_id: string;
}

export interface FollowListDto {
  userId?: string;
  email: string;
  pageSize: number;
  page: number;
}

export interface topFollowerInfo {
  user_id: string;
  user_nickname: string;
  user_image: string;
  deleted_at: string;
}
