import '../config/env';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export const userIdentifier = () => {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    const authCookie = req.signedCookies.user; // 서명된 쿠키

    if ((authHeader && authHeader.startsWith('Bearer ')) || authCookie) {
      return next();
    }

    const cookieValue = 'user-' + uuidv4().replace(/-/g, '');
    res.cookie('user', cookieValue, {
      httpOnly: false, // 개발 중에만 false
      sameSite: 'lax', // 쿠키가 퍼스트 파티로만 사용되도록 설정
      secure: true, // HTTPS에서만 쿠키가 전송됨
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1년
      signed: true // 비밀키 사용, 서명된 쿠키는 req.cookies 대신 req.signedCookies 객체에 속함
    });

    next();
  };
};
