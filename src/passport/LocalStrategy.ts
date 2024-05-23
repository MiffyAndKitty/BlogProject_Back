import { Strategy as LocalStrategy } from 'passport-local';
import { PassportStatic } from 'passport';
import { conn } from '../loaders/mariadb';
import bcrypt from 'bcrypt';

export const local = (passport: PassportStatic) => {
  passport.use('local', new LocalStrategy(passportConfig, passportVerify));
};

const passportConfig = {
  usernameField: 'email',
  passwordField: 'password'
};

const passportVerify = async (
  email: string,
  password: string,
  done: Function
) => {
  try {
    const sql = 'SELECT * FROM User WHERE user_email = ? LIMIT 1';
    const exUser = await conn.query(sql, email);

    if (!exUser[0]) {
      done(null, false, { reason: '존재하지 않는 사용자 입니다.' });
      return;
    }

    const compareResult = await bcrypt.compare(
      password,
      exUser[0].user_password
    );

    if (compareResult) {
      done(null, exUser[0]);
      return;
    }

    done(null, false, {
      reason: '올바르지 않은 아이디/비밀번호가 입력되었습니다.'
    });
  } catch (err: unknown) {
    console.log(err);
    done(err);
  }
};
