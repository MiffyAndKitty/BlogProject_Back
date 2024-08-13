import { Strategy as LocalStrategy } from 'passport-local';
import { PassportStatic } from 'passport';
import { db } from '../loaders/mariadb';
import bcrypt from 'bcrypt';
import { ensureError } from '../errors/ensureError';
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
    const exUser = await db.query(sql, email);

    if (!exUser[0]) {
      return done(null, false, { reason: '존재하지 않는 사용자 입니다.' });
    }

    const compareResult = await bcrypt.compare(
      password,
      exUser[0].user_password
    );

    if (compareResult) {
      return done(null, {
        userId: exUser[0].user_id,
        userEmail: exUser[0].user_email
      });
    }

    done(null, false, {
      reason: '올바르지 않은 아이디/비밀번호가 입력되었습니다.'
    });
  } catch (err) {
    const error = ensureError(err);
    console.log('로컬 전략 오류 : ', error.message);
    done(error);
  }
};
