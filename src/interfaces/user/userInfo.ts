export interface UserEmailDto {
  email: string;
}

export interface UserIdDto {
  userId: string;
}

export interface UserInfoDto extends UserIdDto {
  email: string;
}

export interface UserPwDto extends UserIdDto {
  password: string;
}

export interface UserLoginDto {
  email: string;
  password: string;
}

// 사용자 정보 상세 조회 UserEmailDto, UserNicknameDto
export interface UserEmailDto {
  userId?: string;
  email: string;
}

export interface UserNicknameDto {
  userId?: string;
  nickname: string;
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
