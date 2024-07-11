import 'dotenv/config';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PassportStatic } from 'passport';
import { db } from '../loaders/mariadb';
import { isGoogleProfile } from '../utils/typegard/isGoogleProfile';
import { ensureError } from '../errors/ensureError';
export const google = (passport: PassportStatic) => {
  passport.use('google', new GoogleStrategy(passportConfig, passportVerify));
};

const passportConfig = {
  clientID: process.env.GOOGLE_ID!,
  clientSecret: process.env.GOOGLE_SECRET!,
  callbackURL: '/auth/google/callback' // 구글 로그인 Redirect URI 경로
};

const passportVerify = async (
  accessToken: string | undefined | null,
  refreshToken: string | undefined | null,
  profile: any,
  done: Function
) => {
  try {
    if (!isGoogleProfile(profile)) {
      return new Error('구글 정보 확인 불가능');
    }
    const googleEmail = profile.emails[0].value;

    const exUser = await db.query(
      // DB에서 구글 유저 존재 유무 확인
      'SELECT * FROM User WHERE user_provider = ? AND user_email = ? LIMIT 1;',
      ['google', googleEmail]
    );
    if (exUser[0] && exUser[0].user_id) {
      done(null, { id: exUser[0].user_id, nickname: exUser[0].user_nickname }); // 이미 회원가입 된 유저
      return;
    } else {
      done(null, { email: googleEmail });
    }
  } catch (err) {
    const error = ensureError(err);
    console.log('구글 전략 오류 : ', error.message);
    done(error);
  }
};
