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
    console.log(profile.emails[0].value, profile.name.familyName);

    const googleUser = {
      id: '',
      email: profile.emails[0].value,
      nickname: profile.name.familyName,
      provider: 'google'
    };

    const exUser = await db.query(
      // DB에서 구글 유저 존재 유무 확인
      'SELECT * FROM User WHERE user_provider = ? AND user_email = ? LIMIT 1;',
      ['google', googleUser.email]
    );
    if (exUser[0] && exUser[0].user_id) {
      done(null, exUser[0].user_id);
      return;
    }

    // 사용자가 데이터 베이스에 없으면 저장
    const saveNewUser = await db.query(
      'INSERT INTO User (user_email, user_nickname, user_provider) VALUES (?, ?, ?)',
      [googleUser.email, googleUser.nickname, 'google']
    );

    // 저장된 유저 확인 (id를 가져오기 위해)
    const newUser =
      saveNewUser.affectedRows === 1
        ? await db.query(
            'SELECT * FROM User WHERE user_provider = ? AND user_email = ? LIMIT 1;',
            ['google', googleUser.email]
          )
        : done(null, false);

    newUser[0] ? done(null, newUser[0].user_id) : done(null, false);
  } catch (err) {
    const error = ensureError(err);
    console.log('구글 전략 오류 : ', error.message);
    done(error);
  }
};
