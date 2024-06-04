import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { googleAuthService } from '../services/auth/passport-google-login-auth';
import { localAuthService } from '../services/auth/passport-local-login';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { AuthService } from '../services/auth/auth';
import { ensureError } from '../errors/ensureError';
import { BasicResponse, SingleDataResponse } from '../interfaces/response';
import { UserDto } from '../interfaces/user';
import { validate } from '../middleware/express-validation';
import { body, header } from 'express-validator';

export const authRouter = Router();

// 로컬 로그인
authRouter.post(
  '/login',
  validate([
    body('email').isEmail(),
    body('password')
      .isLength({ min: 8 })
      .matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/)
  ]),
  async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (err?: any, user?: any, info?: any) => {
      try {
        if (err) {
          return res.status(500).send({ result: false, message: err.message });
        }

        if (!user) {
          return res.status(400).send({
            result: false,
            message: info.reason
          });
        }

        req.login(user, { session: false }, async (err) => {
          if (err) return err;

          const result: SingleDataResponse = await localAuthService(user); //userid
          if (result.result === true) {
            return res
              .set('Authorization', `Bearer ${result.data}`)
              .status(200)
              .send({ result: result.result, message: result.message });
          } else {
            return res.status(500).set('Authorization', '').send({
              result: result.result,
              message: result.message
            });
          }
        });
      } catch (err) {
        const error = ensureError(err);
        console.log(error.message);
        return res.status(500).send({ result: false, message: error.message });
      }
    })(req, res, next);
  }
);

//구글 로그인 라우터, 실행 시 구글 로그인 페이지로 redirect
authRouter.get(
  '/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

// 구글에서 넘겨받은 사용자 정보를 이용하여 회원가입 및 로그인 진행
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/auth/login',
    session: false
  }),
  async (req: Request, res: Response) => {
    try {
      const result: SingleDataResponse =
        typeof req.user !== 'string'
          ? { result: false, data: '', message: '유저 정보 확인 실패' }
          : await googleAuthService(req.user);

      if (result.result === true) {
        return res
          .status(200)
          .set('Authorization', `Bearer ${result.data}`)
          .send({ result: result.result, message: result.message });
      } else {
        return res
          .status(500)
          .send({ result: result.result, message: result.message });
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 로그아웃
authRouter.get(
  '/logout',
  validate([header('Authorization').matches(/^Bearer\s[^\s]+$/)]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '로그인 상태가 아닙니다.'
        });

      const result: BasicResponse = await AuthService.deleteToken(req.id);

      if (result.result === true) {
        return res.set('Authorization', '').status(200).send(result);
      } else {
        return res.status(401).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 회원가입
authRouter.post(
  '/sign',
  validate([
    body('email').isEmail(),
    body('password')
      .isLength({ min: 8 })
      .matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/),
    body('nickname').notEmpty()
  ]),
  async (req: Request, res: Response) => {
    try {
      const newUser: UserDto = req.body;
      const result: BasicResponse = await AuthService.saveUser(newUser);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(400).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);
