import { Router, Request, Response } from 'express';
import { ensureError } from '../errors/ensureError';
import { BasicReturnType } from '../interfaces';
import { validateDto } from '../middleware/validateDto';
import { DbColumnDto } from '../dtos/dbColumn.dto';
import { UsersService } from '../services/users';
export const usersRouter = Router();

usersRouter.post(
  '/duplication',
  await validateDto(DbColumnDto),
  async (req: Request, res: Response) => {
    try {
      const result: BasicReturnType = await UsersService.isDuplicated(req.body);

      if (result.result === true) {
        return res.status(200).send(result);
      } else {
        return res.status(400).send(result);
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);
