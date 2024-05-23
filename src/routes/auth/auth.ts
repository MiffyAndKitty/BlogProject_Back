import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { googleAuthService } from '../../services/auth/passport-google-login-auth';
import { localAuthService } from '../../services/auth/passport-local-login';
import { jwtAuth } from '../../middleware/passport-jwt-checker';
import { AuthService } from '../../services/auth/auth';
import { ensureError } from '../../errors/ensureError';
import { BasicReturnType, DataReturnType } from '../../interfaces';
import { validateDto } from '../../middleware/validateDto';
import { UserDto, OAuthUserDto } from '../../dtos';

export const authRouter = Router();

// 로컬 로그인
authRouter.post(
  '/login',
  await validateDto(UserDto),
  async (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate('local', (err?: any, user?: any, info?: any) => {
      try {
        console.log(user);
        if (err) {
          return err;
        }

        if (!user) {
          return res.status(400).send({
            result: false,
            message: info.reason
          });
        }

        req.login(user, { session: false }, async (err) => {
          if (err) {
            return err;
          }
          const result: DataReturnType = await localAuthService(user.user_id);

          if (result.result === true) {
            return res
              .status(200)
              .set('Authorization', `Bearer ${result.data}`)
              .send(result);
          } else {
            return res.status(500).set('Authorization', '').send(result);
          }
        });
      } catch (err) {
        const error = ensureError(err);
        console.log(error.message);
        return { result: false, message: error.message };
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
  await validateDto(OAuthUserDto, 'user'),
  async (req: Request, res: Response) => {
    try {
      console.log('req.user', req.user);

      const result = await googleAuthService(req.user as OAuthUserDto);

      if (result.result === true) {
        return res
          .status(200)
          .set('Authorization', `Bearer ${result.data}`)
          .send(result);
      } else {
        return res.status(500).set('Authorization', '').send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }
);

// 로그아웃
authRouter.get('/logout', jwtAuth, async (req: Request, res: Response) => {
  try {
    if (!req.id)
      return res
        .set('Authorization', '')
        .status(401)
        .send({ result: false, message: '로그인 상태가 아닙니다.' });

    const result: BasicReturnType = await AuthService.deleteToken(req.id);

    if (result.result === true) {
      return res.set('Authorization', '').status(200).send(result);
    } else {
      return res.set('Authorization', '').status(401).send(result);
    }
  } catch (err) {
    const error = ensureError(err);
    console.log(error.message);
    return { result: false, message: error.message };
  }
});

// 회원가입
authRouter.post(
  '/sign',
  await validateDto(UserDto),
  async (req: Request, res: Response) => {
    try {
      const result: BasicReturnType = await AuthService.saveUser(req.body);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(400).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  }
);
