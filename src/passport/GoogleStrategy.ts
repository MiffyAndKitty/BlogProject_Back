import 'dotenv/config';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { PassportStatic } from 'passport';
import { conn } from '../loaders/mariadb';
import { OAuthUserDto } from '../dtos';
import { isGoogleProfile } from '../utils/typegard/isGoogleProfile';

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

    const userDto: OAuthUserDto = {
      id: '',
      email: profile.emails[0].value,
      nickname: profile.name.familyName,
      provider: 'google',
      new: false
    };

    const exUser = await conn.query(
      // DB에서 구글 유저 존재 유무 확인
      'SELECT * FROM User WHERE user_provider = ? AND user_email = ? LIMIT 1;',
      ['google', userDto.email]
    );
    if (exUser[0] && exUser[0].user_id) {
      userDto.id = exUser[0].user_id;
      done(null, userDto);
      return;
    } else {
      userDto.new = true;
    }

    // 사용자가 데이터 베이스에 없으면 저장
    console.log(exUser, '구글전략- 유저 없음');
    const saveNewUser = await conn.query(
      'INSERT INTO User (user_email, user_nickname, user_provider) VALUES (?, ?, ?)',
      [userDto.email, userDto.nickname, 'google']
    );

    // 저장된 유저 확인 (id를 가져오기 위해)
    const newUser = await conn.query(
      'SELECT * FROM User WHERE user_provider = ? AND user_email = ? LIMIT 1;',
      ['google', userDto.email]
    );

    if (saveNewUser.affectedRows === 1) {
      userDto.id = newUser[0].user_id;
      done(null, userDto);
    } else {
      done(null, false);
    }
  } catch (err: unknown) {
    console.log(err);
    done(err);
  }
};
