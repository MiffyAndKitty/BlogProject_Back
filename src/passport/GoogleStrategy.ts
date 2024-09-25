import '../config/env';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PassportStatic } from 'passport';
import { db } from '../loaders/mariadb';
import { isGoogleProfile } from '../utils/typegaurd/isGoogleProfile';
import { GoogleLoginUserDto } from '../interfaces/auth';
export const google = (passport: PassportStatic) => {
  passport.use('google', new GoogleStrategy(passportConfig, passportVerify));
};

const passportConfig = {
  clientID: process.env.GOOGLE_ID!,
  clientSecret: process.env.GOOGLE_SECRET!,
  callbackURL: 'https://mk-blogservice.site/api/auth/google/callback' //'/api/auth/google/callback' // 구글 로그인 Redirect URI 경로
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
    if (!exUser) {
      done(null, {
        userId: undefined,
        userEmail: googleEmail,
        accessToken: undefined
      });
      return;
    }
    if (exUser[0].deleted_at) {
      const { affectedRows: restoredCount } = await db.query(
        `UPDATE User SET deleted_at = NULL WHERE user_id = ? LIMIT 1;`,
        [exUser[0].user_id]
      );
      restoredCount === 1
        ? console.log('탈퇴했던 구글 사용자 복구 성공')
        : console.log('탈퇴했던 구글 사용자 복구 실패');
    }

    done(null, {
      userId: exUser[0].user_id,
      userEmail: exUser[0].user_email,
      accessToken: accessToken
    } as GoogleLoginUserDto);
    return;
  } catch (err) {
    done(err);
  }
};
