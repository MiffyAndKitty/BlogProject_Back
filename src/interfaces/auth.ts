export interface LoginUserDto {
  userId?: string;
  userEmail: string;
}

export interface LoginServiceDto extends LoginUserDto {
  userId: string;
}

export interface GoogleLoginUserDto extends LoginUserDto {
  accessToken?: string;
}

export interface GoogleLoginServiceDto extends GoogleLoginUserDto {
  userId: string;
  accessToken: string;
}

export interface SignUpDto {
  email: string;
  password?: string;
  nickname: string;
  provider?: string;
}
