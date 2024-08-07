import './config/env';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import { dbConnector } from './loaders/mariadb';
import { redisConnector } from './loaders/redis';
import passport from 'passport';
import { passportLoader } from './passport';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { boardRouter } from './routes/board';
import { categoryRouter } from './routes/category';
import { tagRouter } from './routes/tag';
import { tagCacheJob } from './loaders/scheduler/tagCacheJob';
import { boardUpdateJob } from './loaders/scheduler/boardUpdateJob';
import { userIdentifier } from './middleware/userIdentifier';

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ['Authorization']
  })
);
app.use(express.json());
app.use(morgan('dev'));
app.use(cookieParser(process.env.COOKIE_SECRET));

redisConnector;
await dbConnector();

tagCacheJob(10);
boardUpdateJob;

app.use(passport.initialize());
await passportLoader();

app.use('/', userIdentifier());
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/board', boardRouter);
app.use('/category', categoryRouter);
app.use('/tag', tagRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.log('[ 에러 핸들러 입니다! ]', err);
  return res
    .status(500)
    .send({ result: false, message: `서버 오류 발생 : ${err.message}` });
});

app.listen(process.env.SECRET_PORT, () => {
  console.log('server is listening');
});
