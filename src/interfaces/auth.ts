export interface GoogleUserLoginDto {
  userId?: string;
  userEmail: string;
  accessToken: string;
  refreshToken?: string;
}

export interface LoginServiceDto {
  userId: string;
  userEmail: string;
}

export interface SignUpDto {
  email: string;
  password?: string;
  nickname: string;
  provider?: string;
}
