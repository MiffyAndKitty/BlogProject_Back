export interface UserIdDto {
  userId: string;
}

export interface UserInfoDto extends UserIdDto {
  email: string;
}

export interface UserPwDto extends UserIdDto {
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
