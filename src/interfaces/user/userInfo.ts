export interface UserInfoDto {
  userId?: string;
  nickname?: string;
  email: string;
}

export interface UserIdDto {
  userId: string;
}

export interface UserPwDto extends UserIdDto {
  password: string;
}

export interface UserProfileDto extends UserPwDto {
  nickname: string;
  profilePicture: string;
  statusMessage: string;
}

export interface FollowListDto {
  userId?: string;
  email: string;
  pageSize: number;
  page: number;
}

export interface CommentListDto {
  userId?: string;
  email?: string;
  sort: string;
  pageSize: number;
  cursor: string;
  isBefore: boolean;
}
