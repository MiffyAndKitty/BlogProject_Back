import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body, query, param } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import {
  CategoryDto,
  CategoryListDto,
  CategorySaveDto
} from '../interfaces/category';
import { categoryService } from '../services/category';

export const categoryRouter = Router();

// 특정 유저의 전체 카테고리 리스트 조회 ( GET : /category/list/:nickname/all)
categoryRouter.get(
  '/list/:nickname/all',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    param('nickname').notEmpty()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const categoryDto: CategoryListDto = {
        nickname: encodeURIComponent(req.params.nickname.split(':')[1]),
        userId: req.id
      };

      const result = await categoryService.getAllList(categoryDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        owner: result.owner,
        message: result.message
      });
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 특정 유저의 카테고리 리스트 조회 ( GET : /category/list?topcategoryId=)
categoryRouter.get(
  '/list/:nickname',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    query('topcategoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{33}$/i)
      .withMessage('topcategory_id는 33자의 문자열이어야 합니다.'),
    param('nickname').notEmpty()
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const categoryDto: CategoryListDto = {
        nickname: encodeURIComponent(req.params.nickname.split(':')[1]),
        userId: req.id,
        topcategoryId: req.query.topcategoryId as string
      };

      const result = await categoryService.getList(categoryDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        owner: result.owner,
        message: result.message
      });
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
    body('topcategoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{33}$/i)
      .withMessage('topcategoryId는 33자의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 생성 권한 없음'
        });
      }

      const categoryDto: CategorySaveDto = {
        userId: req.id,
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
      .matches(/^[0-9a-f]{33}$/i)
      .withMessage('올바른 카테고리 id 형식이 아닙니다.'),
    body('categoryName').notEmpty().withMessage('categoryName은 필수입니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          message: req.tokenMessage || '카테고리 업데이트 권한 없음'
        });
      }

      const categoryDto: CategorySaveDto = {
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
      .matches(/^[0-9a-f]{33}$/i)
      .withMessage('카테고리 id는 33자의 문자열이어야 합니다.')
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
