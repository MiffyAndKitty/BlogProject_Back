import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { dbConnector } from './loaders/mariadb';
import passport from 'passport';
import { passportLoader } from './passport';

const app = express();

app.use(express.json());
app.use(cors());

await dbConnector();

app.use(passport.initialize());
passportLoader();

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  return res.status(500).json({ message: err.message });
});

app.listen(process.env.SECRET_PORT, () => {
  console.log('server is listening');
});
