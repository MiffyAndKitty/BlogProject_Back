export interface UserInfoDto {
  userId?: string;
  nickname: string;
}

export interface UserProfileDto {
  userId: string;
  nickname: string;
  password: string;
  profilePicture: string;
  statusMessage: string;
}
