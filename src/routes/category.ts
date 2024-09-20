import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body, query, param } from 'express-validator';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import {
  CategoryDto,
  CategoryListDto,
  NewCategoryDto,
  UpdateCategoryLevelDto,
  UpdateCategoryNameDto
} from '../interfaces/category';
import { categoryService } from '../services/category';
import { validateFieldByteLength } from '../utils/validation/validateFieldByteLength ';
import { CATEGORY_NAME_MAX, USER_NICKNAME_MAX } from '../constants/validation';
import { handleError } from '../utils/errHandler';
import { UnauthorizedError } from '../errors/unauthorizedError';

export const categoryRouter = Router();

// 특정 유저의 카테고리 리스트 조회 (GET : /category/list/:nickname)
categoryRouter.get(
  '/list/:nickname',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    param('nickname').custom((nickname) =>
      validateFieldByteLength('nickname', nickname, USER_NICKNAME_MAX)
    ),
    query('topcategory-id')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 id는 32자리의 문자열이어야합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const categoryDto: CategoryListDto = {
        nickname: decodeURIComponent(req.params.nickname.split(':')[1]),
        userId: req.id,
        topcategoryId: req.query['topcategory-id'] as string
      };

      const result = await categoryService.getAllList(categoryDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        owner: result.owner,
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 카테고리 생성 (POST : /category)
categoryRouter.post(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryName')
      .trim()
      .notEmpty()
      .custom((categoryName) =>
        validateFieldByteLength('categoryName', categoryName, CATEGORY_NAME_MAX)
      ),
    body('topcategoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('topcategoryId는 32자의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 유저만 카테고리를 추가할 수 있습니다.'
        );
      }

      const categoryDto: NewCategoryDto = {
        userId: req.id,
        topcategoryId: req.body.topcategoryId,
        categoryName: req.body.categoryName
      };
      const result = await categoryService.create(categoryDto);

      return res
        .status(result.result ? 201 : 500)
        .send({ message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 카테고리명 수정 (PUT : /category/name)
categoryRouter.put(
  '/name',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 카테고리 id 형식이 아닙니다.'),
    body('categoryName')
      .trim()
      .notEmpty()
      .custom((categoryName) =>
        validateFieldByteLength('categoryName', categoryName, CATEGORY_NAME_MAX)
      )
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage ||
            '로그인된 유저만 카테고리 이름을 수정할 수 있습니다.'
        );
      }

      const categoryDto: UpdateCategoryNameDto = {
        userId: req.id,
        categoryId: req.body.categoryId,
        categoryName: req.body.categoryName
      };

      const result = await categoryService.modifyName(categoryDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 카테고리 레벨 수정 (PUT : /category/level)
categoryRouter.put(
  '/level',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 카테고리 id 형식이 아닙니다.'),
    body('topcategoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('topcategoryId는 32자의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage ||
            '로그인된 유저만 카테고리 레벨을 추가할 수 있습니다.'
        );
      }

      const categoryDto: UpdateCategoryLevelDto = {
        userId: req.id,
        categoryId: req.body.categoryId,
        topcategoryId: req.body.topcategoryId
      };

      const result = await categoryService.modifyLevel(categoryDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 카테고리 삭제 (DELETE : /category)
categoryRouter.delete(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('categoryId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 id는 32자의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 유저만 카테고리를 삭제할 수 있습니다.'
        );
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
      handleError(err, res);
    }
  }
);
