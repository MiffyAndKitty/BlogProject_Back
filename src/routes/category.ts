import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { UserIdDto } from '../interfaces/userId';
import { CategoryDto } from '../interfaces/category';
import { categoryService } from '../services/category';
export const categoryRouter = Router();

// 카테고리 리스트 조회
categoryRouter.get(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 조회 권한 없음'
        });
      }

      const userIdDto: UserIdDto = { userId: req.id };
      const result = await categoryService.getList(userIdDto);

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
    body('categoryName').notEmpty()
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
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 카테고리 id 형식이 아닙니다.'),
    body('categoryName').notEmpty()
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
        userId: req.id,
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
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 카테고리 id 형식이 아닙니다.')
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
        userId: req.id,
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
