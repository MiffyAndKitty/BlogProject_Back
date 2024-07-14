import 'dotenv/config';
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { googleAuthService } from '../services/auth/passport-google-login-auth';
import { localAuthService } from '../services/auth/passport-local-login';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { AuthService } from '../services/auth/auth';
import { ensureError } from '../errors/ensureError';
import { BasicResponse, MultipleDataResponse } from '../interfaces/response';
import { UserDto } from '../interfaces/user/user';
import { GoogleLoginUserDto } from '../interfaces/user/GoogleLoginUser';
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

          const result: MultipleDataResponse<string> =
            await localAuthService(user); //userid, usernickname
          if (result.result === true) {
            return res
              .set('Authorization', `Bearer ${result.data[0]}`)
              .status(200)
              .send({
                result: result.result,
                data: result.data[1],
                message: result.message
              });
          } else {
            return res.status(500).set('Authorization', '').send({
              result: result.result,
              data: [],
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
      let result: MultipleDataResponse<string | null> = {
        result: false,
        data: [],
        message: '유저 정보 확인 실패'
      };
      if (
        req.user &&
        'id' in req.user &&
        'nickname' in req.user &&
        typeof req.user.id === 'string' &&
        typeof req.user.nickname === 'string'
      ) {
        result = await googleAuthService(req.user as GoogleLoginUserDto);
      } else if (
        req.user &&
        'email' in req.user &&
        typeof req.user.email === 'string'
      ) {
        result = {
          result: true,
          data: [req.user.email],
          message: '회원가입 되지 않은 구글 유저'
        };
      }
      console.log(result);
      console.log(
        `http://mk-blogservice.site:${process.env.PASSPORT_REDIRECT_PORT}/auth/callback?data=${encodeURIComponent(result.data[0] as string)}&token=${result.data[1]}&message=${encodeURIComponent(result.message)}`
      );
      if (result.result === true) {
        // 프론트엔드로 리다이렉트하고 JWT 토큰 전달
        return res.redirect(
          `http://mk-blogservice.site:${process.env.PASSPORT_REDIRECT_PORT}/auth/callback?data=${encodeURIComponent(result.data[0] as string)}&token=${result.data[1]}&message=${encodeURIComponent(result.message)}`
        );
      } else {
        return res.redirect(
          `http://mk-blogservice.site:${process.env.PASSPORT_REDIRECT_PORT}/auth/login?error=${encodeURIComponent(result.message)}`
        );
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.redirect(
        `http://mk-blogservice.site:${process.env.PASSPORT_REDIRECT_PORT}/auth/login?error=${error.message}`
      );
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
      .if(body('provider').not().equals('google')) // 'provider'가 'google'이 아닌 경우에만 비밀번호 검증
      .isLength({ min: 8 })
      .matches(/(?=.*[a-z])(?=.*\d)(?=.*[!@#$%^&*])/),
    body('nickname').notEmpty(),
    body('provider').if(body('provider').exists()).isIn(['google']) // 'provider'가 존재하면 'google'인지 확인
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
