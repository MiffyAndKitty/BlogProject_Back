export interface UserEmailInfoDto {
  email: string;
}

export interface PasswordResetLinkDto {
  email: string;
  password: string;
}

export interface EmailVerificationDto {
  email: string;
  verificationCode: number;
}

export interface UserIdDto {
  userId: string;
}
