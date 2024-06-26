import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { dbConnector } from './loaders/mariadb';
import passport from 'passport';
import { passportLoader } from './passport';
import { authRouter } from './routes/auth';
import { usersRouter } from './routes/users';
import { redisConnector } from './loaders/redis';
const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true,
    exposedHeaders: ['Authorization']
  })
);
app.use(express.json());

redisConnector;
await dbConnector();

app.use(passport.initialize());
await passportLoader();
app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  return res
    .status(500)
    .send({ result: false, message: `서버 오류 발생 : ${err.message}` });
});

app.listen(process.env.SECRET_PORT, () => {
  console.log('server is listening');
});
