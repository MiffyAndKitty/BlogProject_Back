import passport from 'passport';
import { local } from './LocalStrategy';
import { google } from './GoogleStrategy';
import { jwtAuth } from './JWTStrategy';

export async function passportLoader() {
  jwtAuth(passport);
  local(passport);
  google(passport);
}
