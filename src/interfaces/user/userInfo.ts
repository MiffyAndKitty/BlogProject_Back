export interface UserInfoDto {
  userId?: string;
  nickname?: string;
  email: string;
}

export interface UserProfileDto {
  userId: string;
  nickname: string;
  password: string;
  profilePicture: string;
  statusMessage: string;
}

export interface UserPwDto {
  userId: string;
  password: string;
}
