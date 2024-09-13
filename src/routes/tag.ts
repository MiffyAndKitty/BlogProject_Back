import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { query } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { LimitRequestDto } from '../interfaces/limitRequestDto';
import { tagService } from '../services/tag';
import { handleError } from '../utils/errHandler';

export const tagRouter = Router();

tagRouter.get(
  '/popularity',
  validate([
    query('limit')
      .optional({ checkFalsy: true })
      .toInt()
      .isInt({ min: 1, max: 10 })
      .withMessage('limit의 값이 존재한다면 1보다 큰 양수여야합니다.')
  ]),
  async (req: Request, res: Response) => {
    try {
      const tagDto: LimitRequestDto = {
        limit: (req.query.limit as unknown as number) || 10
      };

      const result = await tagService.getPopularList(tagDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);
