import { Router, Request, Response } from 'express';
import { ensureError } from '../errors/ensureError';
import { BasicReturnType } from '../interfaces';
import { UsersService } from '../services/users';
import { body } from 'express-validator';
import { validate } from '../middleware/express-validation';
import { DbColumnDto } from '../interfaces/dbColumn';
export const usersRouter = Router();

usersRouter.post(
  '/duplication',
  validate([
    body('column').isIn(['user_email', 'user_nickname']),
    body('data').isString()
  ]),
  async (req: Request, res: Response) => {
    try {
      const data: DbColumnDto = req.body;
      const result: BasicReturnType = await UsersService.isDuplicated(data);

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
