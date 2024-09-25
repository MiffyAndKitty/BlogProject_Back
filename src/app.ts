import './config/env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { logger } from './middleware/logger';
import { userIdentifier } from './middleware/userIdentifier';
import { dbConnector } from './loaders/mariadb';
import { mongoDbConnector } from './loaders/mongodb';
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
import { notificationsRouter } from './routes/notifications';
import { accountRouter } from './routes/account';
import { loadAllSchedules } from './loaders/scheduler';
import { draftRouter } from './routes/draft';

export const app = express();

app.use(
  cors({
    origin: process.env.ORIGIN_URL,
    credentials: true,
    exposedHeaders: ['Authorization']
  })
);
app.use(express.json());
app.use(logger);
app.use(cookieParser(process.env.COOKIE_SECRET));

redisConnector;
await mongoDbConnector();
await dbConnector();

loadAllSchedules();

app.use(passport.initialize());
await passportLoader();

app.use('/api-docs', ...swaggerConnector());
app.use('/api', userIdentifier());

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/board', boardRouter);
app.use('/api/draft', draftRouter);
app.use('/api/category', categoryRouter);
app.use('/api/tag', tagRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/comment', commentRouter);
app.use('/api/account', accountRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log('[ 에러 핸들러 입니다! ]', err);
  return res
    .status(500)
    .send({ result: false, message: `서버 오류 발생 : ${err.message}` });
});

app.listen(process.env.SECRET_PORT, () => {
  console.log('server is listening');
});
