export interface UserInfoDto {
  userId: string;
  email: string;
}

export interface UserEmailDto {
  userId?: string;
  email: string;
}

export interface UserNicknameDto {
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
