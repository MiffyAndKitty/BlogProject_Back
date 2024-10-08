export interface UserInfoDto {
  userId: string;
  email: string;
}

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

export interface UserProfileDto {
  userId: string;
  nickname?: string;
  password?: string;
  profilePicture?: string;
  statusMessage?: string;
}
