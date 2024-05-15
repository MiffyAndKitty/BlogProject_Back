import passport from 'passport';
import { local } from './LocalStrategy';

export function passportLoader() {
  local(passport);
}
