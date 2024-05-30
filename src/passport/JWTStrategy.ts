import 'dotenv/config';
import { ExtractJwt, Strategy as JWTStrategy } from 'passport-jwt';
import { PassportStatic } from 'passport';
import { isPayload } from '../utils/typegard/isPayload';
import { ensureError } from '../errors/ensureError';

export const jwtAuth = (passport: PassportStatic) => {
  passport.use('jwt', new JWTStrategy(JWTConfig, JWTVerify));
};

// 유효성 검증, 토큰이 유효하지 않으면 여기서 전략 종료하고,
// done(null, false, 'TokenExpiredError: jwt expired ...')을 호출.
const JWTConfig = {
  jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(), // accesstoken
  secretOrKey: process.env.ACCESS_SECRET_KEY!
};

const JWTVerify = async (jwtPayload: object | undefined, done: Function) => {
  try {
    if (isPayload(jwtPayload)) {
      return done(null, jwtPayload.id);
    }
    console.log(1, jwtPayload);
    done(null, false, { reason: '올바르지 않은 payload 형식의 access 토큰' });
  } catch (err) {
    const error = ensureError(err);
    console.log('jwt 전략 오류 : ', error.message);
    done(error);
  }
};
