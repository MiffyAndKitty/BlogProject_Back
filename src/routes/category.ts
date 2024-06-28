import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body, query } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { CategoryDto } from '../interfaces/category';
import { categoryService } from '../services/category';

export const categoryRouter = Router();

// 특정 유저의 카테고리 리스트 조회 ( GET : /category/list?level=&topcategory_id=)
categoryRouter.get(
  '/list',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    query('level').optional(),
    query('topcategory_id')
      .optional()
      .matches(/^[0-9a-f]{36}$/i)
      .withMessage('topcategory_id는 36자의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 조회 권한 없음'
        });
      }

      const categoryDto: CategoryDto = {
        userId: req.id,
        level: Number(req.query.level) || 0, // 기본으로 최상위 카테고리 조회
        topcategoryId: req.query.topcategory_id as string
      };
      const result = await categoryService.getList(categoryDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ data: result.data, message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 카테고리 생성
categoryRouter.post(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryName').notEmpty(),
    body('level')
      .optional()
      .isInt({ min: 0 })
      .withMessage('level은 0 이상의 정수여야 합니다.'),
    body('topcategory_id')
      .optional()
      .matches(/^[0-9a-f]{36}$/i)
      .withMessage('topcategory_id는 36자의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 생성 권한 없음'
        });
      }

      const categoryDto: CategoryDto = {
        userId: req.id,
        level: req.body.level,
        topcategoryId: req.body.topcategoryId,
        categoryName: req.body.categoryName
      };
      const result = await categoryService.create(categoryDto);

      return res
        .status(result.result ? 201 : 500)
        .send({ message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 카테고리명 수정
categoryRouter.put(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryId')
      .matches(/^[0-9a-f]{36}$/i)
      .withMessage('올바른 카테고리 id 형식이 아닙니다.'),
    body('categoryName').notEmpty().withMessage('categoryName은 필수입니다.'),
    body('level')
      .optional()
      .isInt({ min: 0 })
      .withMessage('level은 0 이상의 정수여야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 업데이트 권한 없음'
        });
      }

      const categoryDto: CategoryDto = {
        level: req.body.level,
        categoryId: req.body.categoryId,
        categoryName: req.body.categoryName
      };

      const result = await categoryService.modify(categoryDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 카테고리 삭제
categoryRouter.delete(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryId')
      .matches(/^[0-9a-f]{36}$/i)
      .withMessage('카테고리 id는 36자의 문자열이어야 합니다.'),
    body('level')
      .optional()
      .isInt({ min: 0 })
      .withMessage('level은 0 이상의 정수여야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 삭제 권한 없음'
        });
      }

      const categoryDto: CategoryDto = {
        level: req.body.level,
        categoryId: req.body.categoryId
      };
      const result = await categoryService.delete(categoryDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);
