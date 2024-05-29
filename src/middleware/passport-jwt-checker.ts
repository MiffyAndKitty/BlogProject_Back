import { Request, Response, NextFunction } from 'express';
import passport from 'passport';
import { reissueToken } from '../utils/token/reissueToken';

export async function jwtAuth(req: Request, res: Response, next: NextFunction) {
  passport.authenticate(
    'jwt', // jwt전략을 통해 access 확인
    { session: false },
    async (err: Error | null, userId?: string | false, info?: object) => {
      // jwt 전략에서 토큰이 유효하지 않으면 자동으로 매겨변수를 (null, false, {토큰 유효성 검사 결과})를 반환합니다.
      // userId : 문자열 타입으로 존재한다면 유효한 access토큰을 decoded하여 얻은 값
      if (err) {
        return next(err);
      }
      if (typeof userId === 'string') {
        req.id = userId;
        return next();
      }

      const accessToken = req.header('Authorization')?.split('Bearer ')[1];

      !accessToken
        ? next()
        : (async () => {
            const reissued = await reissueToken(accessToken); // refresh 토큰의 유효성을 따져서 재발급
            req.tokenMessage = '[만료된 access토큰]' + reissued.message;

            if (!reissued.result) return next();

            if ('data' in reissued) {
              req.id = reissued.data[0];
              req.newAccessToken = reissued.data[1];
            }

            next();
          })();
    }
  )(req, res, next);
}
