import { IsEmail, Matches, IsString, IsIn, IsBoolean } from 'class-validator';

export class OAuthUserDto {
  @IsString()
  id!: string;

  @IsEmail()
  @Matches(/^\S+$/, { message: 'Email should not contain spaces' })
  email!: string;

  @Matches(/^\S+$/, { message: 'Nickname should not contain spaces' })
  nickname!: string;

  @IsIn(['google'])
  provider!: string;
}
