import '../config/env';
import bcrypt from 'bcrypt';

export async function getHashed(userpwd: string) {
  const hashedpw = await bcrypt.hash(userpwd, process.env.SALT!);
  return hashedpw;
}
