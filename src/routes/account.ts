import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body } from 'express-validator';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { AccountService } from '../services/account';
import { ensureError } from '../errors/ensureError';
import { BasicResponse, SingleDataResponse } from '../interfaces/response';
import {
  PasswordResetLinkDto,
  UserEmailInfoDto,
  UserIdDto
} from '../interfaces/account';
import { handleError } from '../utils/errHandler';
import { UnauthorizedError } from '../errors/unauthorizedError';

export const accountRouter = Router();

// 임시 비밀번호 메일 전송
accountRouter.post(
  '/temp-password',
  validate([
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요.')
  ]),
  async (req: Request, res: Response) => {
    try {
      const userEmailInfoDto: UserEmailInfoDto = {
        email: req.body.email
      };
      const result: SingleDataResponse =
        await AccountService.setTemporaryPassword(userEmailInfoDto);

      if (!result.result) {
        return res.status(500).send({
          result: result.result,
          message: result.message
        });
      }

      res.status(200).send({
        result: result.result,
        message: result.message
      });

      const passwordResetLinkDto: PasswordResetLinkDto = {
        email: req.body.email,
        password: result.data
      };

      AccountService.sendPasswordResetLink(passwordResetLinkDto)
        .then((sentResult) => {
          console.log(`${sentResult.message} : ${passwordResetLinkDto.email}`);
        })
        .catch((err) => {
          console.error(`이메일 전송 오류: ${err.message}`);
        });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 회원 탈퇴
accountRouter.delete(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        throw new UnauthorizedError(
          req.tokenMessage || '현재 로그인 상태가 아닙니다'
        );

      const userIdDto: UserIdDto = { userId: req.id };

      const result: BasicResponse =
        await AccountService.deleteUserAccount(userIdDto);

      return res.status(result.result ? 200 : 500).send({
        result: result.result,
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);
