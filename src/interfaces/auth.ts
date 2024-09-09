export interface LoginUserDto {
  userId?: string;
  userEmail: string;
}

export interface LoginServiceDto extends LoginUserDto {
  userId: string;
}

export interface SignUpDto {
  email: string;
  password?: string;
  nickname: string;
  provider?: string;
}
