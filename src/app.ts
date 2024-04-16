import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { plusRouter } from './routes/plus';
const app = express();

app.use(express.json());
app.use(cors());

app.use('/', plusRouter);

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  return res.status(500).json({ message: err.message });
});

app.listen(process.env.SECRET_PORT, () => {
  console.log('server is listening');
});
