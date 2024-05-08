import { Request, Response, NextFunction } from 'express';
import admin from '../config/firebase';

interface UserRequest extends Request {
  user?: object; // 사용자 정보가 담긴 객체 또는 undefined
}

export function tokenChecker(
  req: UserRequest,
  res: Response,
  next: NextFunction
) {
  try {
    const token: string | null =
      req.headers.authorization?.split(' ')[1] ?? null;

    if (token === null) {
      console.log('토큰이 없습니다');
      return res.status(401).json({ error: '존재하지 않는 토큰' });
    }
    const decodedValue = admin.auth().verifyIdToken(token);
    req.user = decodedValue;
    return next();
  } catch (error) {
    return res.status(401).json({ error: '유효하지 않은 토큰' });
  }
}
