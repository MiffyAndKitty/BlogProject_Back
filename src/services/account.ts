import { db } from '../loaders/mariadb';
import { BasicResponse, SingleDataResponse } from '../interfaces/response';
import { getHashed } from '../utils/getHashed';
import { generatePassword } from '../utils/passwordGenerator';
import { sendEMail } from '../utils/sendEmail';
import {
  EmailVerificationDto,
  PasswordResetLinkDto,
  UserEmailInfoDto,
  UserIdDto
} from '../interfaces/account';
import { NotFoundError } from '../errors/notFoundError';
import { InternalServerError } from '../errors/internalServerError';
import { BadRequestError } from '../errors/badRequestError';
import { generateSixDigitNumber } from '../utils/tempCodeGenerator';
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

    if (!user) {
      throw new NotFoundError(
        '존재하지 않는 로컬 회원가입 유저, 혹은 이미 탈퇴한 유저입니다.'
      );
    }

    const query = `UPDATE User SET user_password = ? WHERE user_email = ? AND deleted_at IS NULL`;
    const { affectedRows: updatedCount } = await db.query(query, [
      hashedPassword,
      userEmailInfoDto.email
    ]);

    if (updatedCount !== 1) {
      throw new InternalServerError(
        '임시 발급된 비밀번호 저장에 실패했습니다.'
      );
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
        loginUrl: `${process.env.ORIGIN_URL}/locallogin`
      }
    );

    if (!sent) {
      throw new InternalServerError('비밀번호 재설정 메일 전송 실패');
    }

    return {
      result: true,
      message: '비밀번호 재설정 메일 전송 성공'
    };
  }

  static async setTemporaryCode(userEmailInfoDto: UserEmailInfoDto) {
    const [existedUser] = await db.query(
      `SELECT 1 FROM User WHERE user_email = ?`,
      [userEmailInfoDto.email]
    );

    if (existedUser) throw new BadRequestError('사용할 수 없는 이메일입니다.');

    const tempCode = generateSixDigitNumber();

    return {
      result: true,
      data: tempCode,
      message: '이메일 유효성 확인을 위한 임시 코드 발급 성공'
    };
  }

  // 이메일 유효성 확인을 위한 이메일 전송
  static async sendEmailVerification(
    emailVerificationDto: EmailVerificationDto
  ): Promise<BasicResponse> {
    const sent: boolean = await sendEMail(
      emailVerificationDto.email,
      '이메일 유효성 확인을 위한 링크 전송',
      'emailVerificationTemplate',
      {
        verificationCode: String(emailVerificationDto.verificationCode)
      }
    );

    if (!sent) {
      throw new InternalServerError('이메일 유효성 확인을 위한 메일 전송 실패');
    }

    return {
      result: true,
      message: '이메일 유효성 확인을 위한 메일 전송 성공'
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
        throw new BadRequestError('이미 탈퇴된 회원입니다.');
      default:
        throw new InternalServerError('회원 탈퇴에 실패했습니다.');
    }
  }
}
