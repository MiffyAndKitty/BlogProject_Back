import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { query } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { TagDto } from '../interfaces/tag';
import { tagService } from '../services/tag';

export const tagRouter = Router();

tagRouter.get(
  '/popularity',
  validate([
    query('limit')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1, max: 10 })
      .withMessage('limit의 값이 존재한다면 1보다 큰 양수여야합니다.')
  ]),
  async (req: Request, res: Response) => {
    try {
      const tagDto: TagDto = {
        limit: (req.query.limit as unknown as number) || 10
      };

      const result = await tagService.getPopularList(tagDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        message: result.message
      });
    } catch (err) {
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ data: [], message: error.message });
    }
  }
);
