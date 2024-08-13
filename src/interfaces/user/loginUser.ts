export interface LoginUserDto {
  userId?: string;
  userEmail: string;
}

export interface LoginServiceDto extends LoginUserDto {
  userId: string;
}
