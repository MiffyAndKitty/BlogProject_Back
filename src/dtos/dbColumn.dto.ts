import { IsIn, IsString } from 'class-validator';
export class DbColumnDto {
  @IsIn(['user_email', 'user_nickname'])
  column!: string;

  @IsString()
  data!: string;
}
