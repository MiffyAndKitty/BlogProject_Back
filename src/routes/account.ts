import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body } from 'express-validator';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { AccountService } from '../services/account';
import { ensureError } from '../errors/ensureError';
import { BasicResponse, SingleDataResponse } from '../interfaces/response';
import { UserEmailDto, UserLoginDto } from '../interfaces/user/userInfo';

export const accountRouter = Router();

// 임시 비밀번호 메일 전송
accountRouter.post(
  '/temp-password',
  validate([
    body('email').isEmail().withMessage('유효한 이메일을 입력하세요.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        return res
          .status(401)
          .send({ message: req.tokenMessage || '비로그인 유저' });

      const userInfoDto: UserEmailDto = {
        email: req.body.email
      };
      const result: SingleDataResponse =
        await AccountService.setTemporaryPassword(userInfoDto);

      res.status(result.result ? 200 : 500).send({
        result: result.result,
        message: result.message
      });

      const userLoginDto: UserLoginDto = {
        email: req.body.email,
        password: result.data
      };

      const sentResult =
        await AccountService.sendPasswordResetLink(userLoginDto);

      console.log(`${sentResult.message} : ${userLoginDto.email}`);
    } catch (err) {
      const error = ensureError(err);
      return res.status(500).send({ result: false, message: error.message });
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
        return res
          .status(401)
          .send({ message: req.tokenMessage || '비로그인 유저' });

      const userIdDto: UserIdDto = {
        userId: req.id
      };
      const result: BasicResponse =
        await AccountService.deleteUserAccount(userIdDto);

      return res.status(result.result ? 200 : 500).send({
        message: result.message
      });
    } catch (err) {
      const error = ensureError(err);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);
