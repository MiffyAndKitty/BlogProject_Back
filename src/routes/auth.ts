import '../config/env';
import { Router, Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { googleAuthService } from '../services/auth/passport-google-login-auth';
import { localAuthService } from '../services/auth/passport-local-login';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { AuthService } from '../services/auth/auth';
import {
  BasicResponse,
  MultipleUserDataResponse
} from '../interfaces/response';
import {
  GoogleLoginServiceDto,
  GoogleUserLoginDto,
  LoginServiceDto,
  SignUpDto
} from '../interfaces/auth';
import { validate } from '../middleware/express-validation';
import { body, header } from 'express-validator';
import { USER_NICKNAME_MAX } from '../constants/validation';
import { validateFieldByteLength } from '../utils/validation/validateFieldByteLength ';
import { handleError } from '../utils/errHandler';
import { UnauthorizedError } from '../errors/unauthorizedError';
import { InternalServerError } from '../errors/internalServerError';
import axios from 'axios';
import { db } from '../loaders/mariadb';
import { getRefreshToken } from '../utils/redis/refreshToken';
import '../config/env';
import { google } from 'googleapis';
/*import { BadRequestError } from '../errors/badRequestError';*/

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
        console.log('로컬 로그인 라우터');
        if (err) throw new InternalServerError(err.message);

        if (!user)
          throw new InternalServerError(
            info.reason
          ); /*throw new BadRequestError(info.reason);*/

        req.login(user, { session: false }, async (err) => {
          if (err) throw new InternalServerError(err.message);

          const result: MultipleUserDataResponse = await localAuthService(
            user as LoginServiceDto
          );

          return res
            .set('Authorization', `Bearer ${result.data.accessToken}`)
            .status(result.result ? 200 : 500)
            .send({
              result: result.result,
              data: result.data.userEmail,
              message: result.message
            });
        });
      } catch (err) {
        handleError(err, res);
      }
    })(req, res, next);
  }
);

//구글 로그인 라우터, 실행 시 구글 로그인 페이지로 redirect
authRouter.get(
  '/google',
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    accessType: 'offline', // 서버에서 구글 refresh 토큰을 통해 구글 access 토큰 재발급하는 경우
    prompt: 'select_account' // 사용자에게 계정을 선택하라는 메시지를 표시
  })
);

// 구글에서 넘겨받은 사용자 정보를 이용하여 회원가입 및 로그인 진행
authRouter.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: '/api/auth/login',
    session: false
  }),
  async (req: Request, res: Response) => {
    try {
      console.log('라우터의 req.user!!!', req.user);
      console.log('구글 리다이렉트된 라우터');
      const googleUser = req.user as GoogleUserLoginDto;

      let result: MultipleUserDataResponse = {
        result: false,
        data: {},
        message: '유저 정보 확인 실패'
      };

      if (googleUser.userId && typeof googleUser.userId === 'string') {
        result = await googleAuthService(req.user as GoogleLoginServiceDto);
      } else if (googleUser.userEmail) {
        // !googleUser.userId
        result = {
          result: true,
          data: { accessToken: undefined, userEmail: googleUser.userEmail },
          message: '회원가입 되지 않은 구글 유저'
        };
      }
      if (result.result === true) {
        // 프론트엔드로 리다이렉트하고 JWT 토큰 전달
        return res.redirect(
          `https://mk-blogservice.site/auth/callback?data=${result.data?.userEmail}&token=${result.data.accessToken}&message=${encodeURIComponent(result.message)}`
        );
      }
      return res.redirect(
        `https://mk-blogservice.site/auth/login?error=${encodeURIComponent(result.message)}`
      );
    } catch (err: any) {
      return res.redirect(
        `https://mk-blogservice.site/auth/login?error=${encodeURIComponent(err.message)}`
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
        throw new UnauthorizedError(
          req.tokenMessage || '이미 로그아웃한 유저입니다.'
        );

      const result: BasicResponse = await AuthService.deleteToken(req.id);

      if (result.result === true) {
        return res.set('Authorization', '').status(200).send(result);
      }
      throw new InternalServerError('로그아웃 에러');
    } catch (err) {
      handleError(err, res);
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
    body('nickname')
      .notEmpty()
      .custom((nickname) =>
        validateFieldByteLength('nickname', nickname, USER_NICKNAME_MAX)
      ),
    body('provider').if(body('provider').exists()).isIn(['google']) // 'provider'가 존재하면 'google'인지 확인
  ]),
  async (req: Request, res: Response) => {
    try {
      const newUser: SignUpDto = req.body;
      const result: BasicResponse = await AuthService.saveUser(newUser);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(400).send(result);
      }
    } catch (err) {
      handleError(err, res);
    }
  }
);

authRouter.get('/google/token', (req: Request, res: Response) => {
  const clientId = process.env.GOOGLE_ID;
  const redirectUri = 'https://mk-blogservice.site/api/auth/google/deletion'; // 리디렉션 URI 설정 (Google OAuth 콘솔에서 등록한 리디렉션 URI)
  const scope =
    'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

  // 구글 로그인 페이지로 리디렉션
  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

  return res.status(200).redirect(authUrl);
});

authRouter.get('/google/deletion', (req: Request, res: Response) => {
  return res.status(200).send({ result: true });
});

/*

    console.log('구글 회원 탈퇴 시작 합니다!');
    console.log(req.id);
    if (!req.id)
      throw new UnauthorizedError(
        req.tokenMessage || '이미 로그아웃한 유저입니다.'
      );

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_ID,
      process.env.GOOGLE_SECRET,
      'https://mk-blogservice.site/login'
    );

    // if (!getGoogleRefresh) {
    //   throw new InternalServerError(
    //     'google refresh 토큰이 존재하지 않습니다. 재로그인 해주세요.'
    //    );
    //  }

    // 이미 저장된 refresh token을 사용하여 클라이언트에 설정

    // refresh token을 설정
    const storedRefreshToken = await getRefreshToken(req.id, true); // 저장된 refresh token 가져오기
    console.log('storedRefreshToken');
    console.log(storedRefreshToken);
    oauth2Client.setCredentials({
      refresh_token: storedRefreshToken
    });

    // Access token을 갱신
    const { credentials } = await oauth2Client.refreshAccessToken();
    console.log('credentials');
    console.log(credentials);

    const newAccessToken = credentials.access_token;

    console.log('새로 갱신된 access token:', newAccessToken);

    // 필요 시 새로 발급된 access token을 안전한 장소에 저장 (ex: 데이터베이스나 캐시)
    return newAccessToken;

    console.log('access토큰 : ', credentials.access_token);
    if (!credentials.access_token) {
      return res.status(400).json({ message: '구글 액세스 토큰이 없습니다.' });
    }

    // google-access토큰으로 회원 탈퇴
    const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${credentials.access_token}`;

    try {
      const response = await axios.get(revokeUrl);
      console.log('response.status : ', response.status);

      if (response.status === 200) {
        console.log('구글 탈퇴 성공! 200입니다!');

        // DB에서 유저 탈퇴 처리
        const result = await db.query(
          `UPDATE User SET deleted_at = NOW() WHERE deleted_at IS NULL AND user_provider = 'google' AND user_id = ?`,
          [req.id]
        );

        console.log('데이터 베이스 결과 result : ', result);

        if (result.affectedRows === 1) {
          return res
            .status(200)
            .json({ message: '구글 회원 탈퇴 및 토큰 해제 완료' });
        } else {
          return res
            .status(400)
            .json({ message: 'DB에서 유저 탈퇴 처리 실패' });
        }
      } else {
        console.log('Failed to revoke Google access token:', response.data);
        return res
          .status(400)
          .json({ message: '구글 토큰 해제 실패', details: response.data });
      }
    } catch (err: any) {
      if (err.response && err.response.status === 400) {
        console.log('400 에러 발생: 잘못된 요청 -', err.response.data);
        return res.status(400).json({
          message: '잘못된 요청: 구글 토큰 해제 실패',
          error: err.response.data
        });
      } else {
        console.log('알 수 없는 에러 발생:', err);
        return res
          .status(500)
          .json({ message: `알 수 없는 에러 발생: ${err.message}` });
      }
    }
  }
);
*/
