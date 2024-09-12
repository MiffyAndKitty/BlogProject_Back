export interface UserEmailDto {
  email: string;
}

export interface UserInfoDto {
  userId: string;
  email: string;
}

export interface UserLoginDto {
  email: string;
  password: string;
}

// 사용자 정보 상세 조회 UserEmailDto, UserNicknameDto
export interface UserEmailLookupDto {
  userId?: string;
  email: string;
}

export interface UserNicknameLookupDto {
  userId?: string;
  nickname: string;
}

export interface UserPwDto {
  userId: string;
  password: string;
}

export interface UserProfileDto extends UserPwDto {
  nickname: string;
  profilePicture: string;
  statusMessage: string;
}
