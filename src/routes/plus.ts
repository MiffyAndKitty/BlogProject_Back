import { Router, Request, Response } from 'express'; // @types/express 덕에 타입을 import 해온 것
import { plusService } from '../services/plus';

export const plusRouter = Router();

type plusResult = { success: boolean; data: number | null };
type numsDto = {
  num1: string;
  num2: string;
};

plusRouter.get('/', (req: Request, res: Response) => {
  return res.status(201).json({ result: '안녕하세요.' });
});

plusRouter.post('/', (req: Request, res: Response) => {
  const numsDto: numsDto = {
    num1: (req.body as { num1: string }).num1,
    num2: (req.body as { num2: string }).num2
  };

  const plusResult: plusResult = plusService.plusNums(numsDto);

  if (plusResult.success === true) {
    return res
      .status(201)
      .json({ success: plusResult.success, data: plusResult.data });
  } else {
    return res
      .status(201)
      .json({ success: plusResult.success, data: plusResult.data });
  }
});
