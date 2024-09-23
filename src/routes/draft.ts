import { Router, Request, Response } from 'express';
import { ObjectId } from 'mongodb';
import { validate } from '../middleware/express-validation';
import { header, body, param, query } from 'express-validator';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { DraftService } from '../services/draft';
import { upload } from '../middleware/multer';
import { checkWriter } from '../middleware/checkWriter';
import { handleError } from '../utils/errHandler';
import { UnauthorizedError } from '../errors/unauthorizedError';
import {
  DraftDto,
  DraftIdDto,
  DraftListDto,
  UpdateDraftDto
} from '../interfaces/draft';
import { ForbiddenError } from '../errors/forbiddenError';

export const draftRouter = Router();

// 임시 저장 게시글 목록 조회 (GET: /draft/list)
draftRouter.get(
  '/list',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    query('cursor')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!ObjectId.isValid(value)) {
          throw new Error(
            'cursor의 값인 임시 저장된 게시글 id는 24 길이의 문자열입니다.'
          );
        }
        return true;
      }),
    query('page')
      .optional({ checkFalsy: true })
      .toInt()
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt()
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('is-before')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (value !== 'true' && value !== 'false') {
          throw new Error(
            'is-before 값이 존재한다면 true/false의 문자열이어야합니다.'
          );
        }
        return true;
      })
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        throw new UnauthorizedError(
          req.tokenMessage ||
            '로그인한 유저만 임시 저장된 게시글 목록을 조회할 수 있습니다.'
        );

      const draftListDto: DraftListDto = {
        userId: req.id,
        cursor: (req.query.cursor as string) || undefined,
        page: req.query.page
          ? parseInt(req.query.page as string, 10)
          : undefined,
        pageSize: req.query['page-size']
          ? parseInt(req.query['page-size'] as string, 10)
          : undefined,
        isBefore: req.query['is-before'] === 'true'
      };

      const result = await DraftService.getDraftList(draftListDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 임시 저장 (POST: /draft)
draftRouter.post(
  '/',
  upload('board').array('uploaded_files', 10),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('title').optional({ checkFalsy: true }),
    body('content').optional({ checkFalsy: true }),
    body('public')
      .optional({ checkFalsy: true })
      .isBoolean()
      .withMessage('공개 여부는 불린값의 형태로 입력해야 합니다.'),
    body('tagNames')
      .optional({ checkFalsy: true })
      .custom((tags) => {
        if (typeof tags === 'string') tags = [tags];

        if (!Array.isArray(tags))
          throw new Error('태그는 문자열 또는 배열 형태여야 합니다.');

        if (tags.length > 10)
          throw new Error('태그는 최대 10개까지 허용됩니다.');

        return true;
      })
      .withMessage('태그는 최대 10개까지 입력할 수 있습니다.'),
    body('categoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 ID는 32자리의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        throw new UnauthorizedError(
          req.tokenMessage || '로그인한 유저만 게시글 임시 저장이 가능합니다.'
        );

      const fileUrls: Array<string> = [];

      if (Array.isArray(req.files) && req.files.length > 0) {
        req.files.forEach((file) => {
          if ('location' in file && typeof file.location === 'string') {
            fileUrls.push(file.location);
          }
        });
      }

      const draftDto: DraftDto = {
        userId: req.id as string,
        title: req.body.title,
        content: req.body.content,
        public: req.body.public === 'false' ? false : true,
        tagNames: req.body.tagNames || [],
        categoryId: req.body.categoryId,
        fileUrls: fileUrls
      };

      const result = await DraftService.saveDraft(draftDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 임시 저장된 게시글 수정 (PUT: /draft)
draftRouter.put(
  '/',
  upload('board').array('uploaded_files', 10),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage(
        '올바른 토큰 형식이 아닙니다. Bearer <token> 형식으로 입력해주세요.'
      ),
    body('draftId')
      .optional({ checkFalsy: true })
      .custom((value) => {
        if (!ObjectId.isValid(value)) {
          throw new Error(
            '유효한 임시 저장된 게시글 id는 24 길이의 문자열입니다.'
          );
        }
        return true;
      }),
    body('title').optional({ checkFalsy: true }),
    body('content').optional({ checkFalsy: true }),
    body('public')
      .optional({ checkFalsy: true })
      .isString()
      .withMessage('공개 여부는 문자열 형태로 입력해야 합니다.'),
    body('tagNames')
      .optional({ checkFalsy: true })
      .custom((tags) => {
        if (typeof tags === 'string') tags = [tags];

        if (!Array.isArray(tags))
          throw new Error('태그는 문자열 또는 배열 형태여야 합니다.');

        if (tags.length > 10)
          throw new Error('태그는 최대 10개까지 허용됩니다.');

        return true;
      })
      .withMessage('태그는 최대 10개까지 입력할 수 있습니다.'),
    body('categoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 ID는 32자리의 문자열이어야 합니다.')
  ]),
  jwtAuth,
  checkWriter(true),
  async (req: Request, res: Response) => {
    try {
      if (!req.isWriter)
        throw new ForbiddenError('해당 유저가 임시 저장한 게시글이 아닙니다.');

      const fileUrls: Array<string> = [];

      if (Array.isArray(req.files) && req.files.length > 0) {
        req.files.forEach((file) => {
          if ('location' in file && typeof file.location === 'string') {
            fileUrls.push(file.location);
          }
        });
      }

      const updateDraftDto: UpdateDraftDto = {
        userId: req.id as string,
        draftId: req.body.draftId,
        title: req.body.title,
        content: req.body.content,
        public: req.body.public === 'false' ? false : true,
        tagNames: req.body.tagNames || [],
        categoryId: req.body.categoryId,
        fileUrls: fileUrls
      };

      const result = await DraftService.modifyDraft(updateDraftDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 임시 저장 게시글 조회 (GET: /draft/:draftId)
draftRouter.get(
  '/:draftId',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('draftId')
      .matches(/^:[0-9a-f]{24}$/i)
      .withMessage('올바른 형식의 임시 저장 게시글 id는 24글자의 문자열입니다.')
  ]),
  jwtAuth,
  checkWriter(true),
  async (req: Request, res: Response) => {
    try {
      if (!req.isWriter)
        throw new ForbiddenError('해당 유저가 임시 저장한 게시글이 아닙니다.');

      const draftIdDto: DraftIdDto = {
        userId: req.id as string,
        draftId: req.params.draftId.split(':')[1]
      };

      const result = await DraftService.getDraft(draftIdDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 임시 저장된 게시글 확인 (GET: /draft/:draftId/user-check)
draftRouter.get(
  '/:draftId/user-check',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('draftId')
      .matches(/^:[0-9a-f]{24}$/i)
      .withMessage('올바른 형식의 임시 저장 게시글 id는 24글자의 문자열입니다.')
  ]),
  jwtAuth,
  checkWriter(true),
  async (req: Request, res: Response) => {
    try {
      if (!req.isWriter)
        throw new ForbiddenError('해당 유저가 임시 저장한 게시글이 아닙니다.');

      return res.status(200).send({
        result: true,
        message: '해당 유저가 임시 저장한 게시글입니다.'
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 임시 저장된 게시글 삭제 (DELETE: /draft/:draftId)
draftRouter.delete(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('draftId')
      .matches(/^[0-9a-f]{24}$/i)
      .withMessage('올바른 형식의 임시 저장 게시글 id는 24글자의 문자열입니다.')
  ]),
  jwtAuth,
  checkWriter(true),
  async (req: Request, res: Response) => {
    try {
      if (!req.isWriter)
        throw new ForbiddenError('해당 유저가 임시 저장한 게시글이 아닙니다.');

      const draftIdDto: DraftIdDto = {
        userId: req.id as string,
        draftId: req.body.draftId
      };

      const result = await DraftService.deleteDraft(draftIdDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);
