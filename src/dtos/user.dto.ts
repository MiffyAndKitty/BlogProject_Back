import { Matches, IsEmail, MinLength } from 'class-validator';

export class UserDto {
  @Matches(/^\S+$/) // 문자열에 공백이 포함되지 않도록 검사
  @IsEmail()
  email!: string;

  @Matches(/^\S+$/)
  @MinLength(8)
  @Matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/)
  // 적어도 하나의 소문자, 숫자, 특수문자
  password!: string;

  nickname?: string;
}
