import '../config/env';
import bcrypt from 'bcrypt';

export async function comparePw(
  password: string,
  hashedpw: string
): Promise<boolean> {
  return await bcrypt.compare(password, hashedpw);
}
