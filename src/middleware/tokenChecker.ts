import { Request, Response, NextFunction } from 'express';
import { admin } from '../loaders/firebase';

interface UserRequest extends Request {
  user?: object; // 사용자 정보가 담긴 객체 또는 undefined
  isToken: boolean;
}

export function tokenChecker() {
  return async (req: UserRequest, res: Response, next: NextFunction) => {
    try {
      const token: string | null =
        req.headers.authorization?.split(' ')[1] ?? null;
      console.log(token);
      if (token === null) {
        console.log('토큰이 없습니다');
        req.isToken = false;
        return next();
      }

      const decodedValue = await admin.auth().verifyIdToken(token);
      req.user = decodedValue;
      req.isToken = true;
      return next();
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.log(err.name);
      }
      return res.status(401).json({ error: '유효하지 않은 토큰' });
    }
  };
}
