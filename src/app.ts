import './config/env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { dbConnector } from './loaders/mariadb';
import { redisConnector } from './loaders/redis';
import { swaggerConnector } from './loaders/swagger';
import passport from 'passport';
import { passportLoader } from './passport';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { boardRouter } from './routes/board';
import { categoryRouter } from './routes/category';
import { tagRouter } from './routes/tag';
import { commentRouter } from './routes/comment';
import { userIdentifier } from './middleware/userIdentifier';
import { notificationsRouter } from './routes/notifications';
import { loadAllSchedules } from './loaders/scheduler';

export const app = express();

app.use(
  cors({
    origin: process.env.ORIGIN_URL,
    credentials: true,
    exposedHeaders: ['Authorization']
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser(process.env.COOKIE_SECRET));

redisConnector;
await dbConnector();

loadAllSchedules();

app.use(passport.initialize());
await passportLoader();

app.use('/api-docs', ...swaggerConnector());
app.use('/api', userIdentifier());

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/board', boardRouter);
app.use('/api/category', categoryRouter);
app.use('/api/tag', tagRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/comment', commentRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log('[ 에러 핸들러 입니다! ]', err);
  return res
    .status(500)
    .send({ result: false, message: `서버 오류 발생 : ${err.message}` });
});

app.listen(process.env.SECRET_PORT, () => {
  console.log('server is listening');
});
