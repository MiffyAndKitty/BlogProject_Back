import { db } from '../loaders/mariadb';
import { BasicResponse, SingleDataResponse } from '../interfaces/response';
import { getHashed } from '../utils/getHashed';
import { generatePassword } from '../utils/passwordGenerator';
import { sendEMail } from '../utils/sendEmail';
import {
  PasswordResetLinkDto,
  UserEmailInfoDto,
  UserIdDto
} from '../interfaces/account';

export class AccountService {
  static async setTemporaryPassword(
    userEmailInfoDto: UserEmailInfoDto
  ): Promise<SingleDataResponse> {
    const temporaryPassword = generatePassword();

    const hashedPassword = await getHashed(temporaryPassword);

    const [user] = await db.query(
      `SELECT deleted_at FROM User WHERE user_email = ? AND user_provider IS NULL;`,
      [userEmailInfoDto.email]
    );

    if (!user || user.deleted_at !== null) {
      return {
        result: false,
        data: '',
        message: '이미 탈퇴한 유저 혹은 존재하지 않는 로컬 회원가입 유저입니다.'
      };
    }

    const query = `UPDATE User SET user_password = ? WHERE user_email = ? AND deleted_at IS NULL`;
    const { affectedRows: updatedCount } = await db.query(query, [
      hashedPassword,
      userEmailInfoDto.email
    ]);

    if (updatedCount !== 1) {
      return {
        result: false,
        data: '',
        message: '임시 발급된 비밀번호 저장 실패'
      };
    }

    return {
      result: true,
      data: temporaryPassword,
      message: '임시 발급된 비밀번호 저장 성공'
    };
  }

  // 비밀번호 재설정 링크 전송
  static async sendPasswordResetLink(
    passwordResetLinkDto: PasswordResetLinkDto
  ): Promise<BasicResponse> {
    const sent: boolean = await sendEMail(
      passwordResetLinkDto.email,
      '임시 비밀번호 발급',
      'passwordResetTemplate',
      {
        password: passwordResetLinkDto.password,
        loginUrl: `${process.env.ORIGIN_URL}/login`
      }
    );

    return sent
      ? {
          result: true,
          message: '비밀번호 재설정 메일 전송 성공'
        }
      : {
          result: false,
          message: '비밀번호 재설정 메일 전송 실패'
        };
  }

  // 회원 탈퇴
  static async deleteUserAccount(userIdDto: UserIdDto): Promise<BasicResponse> {
    const query = `UPDATE User SET deleted_at = NOW() WHERE user_id = ? AND deleted_at IS NULL`;
    const result = await db.query(query, [userIdDto.userId]);

    switch (result.affectedRows) {
      case 1:
        return {
          result: true,
          message: '회원 탈퇴가 성공적으로 처리되었습니다.'
        };
      case 0:
        return {
          result: false,
          message: '이미 탈퇴된 회원입니다.'
        };
      default:
        return { result: false, message: '회원 탈퇴에 실패했습니다.' };
    }
  }
}
