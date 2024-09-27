import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body, param, query } from 'express-validator';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { BoardService } from '../services/board/board';
import { saveBoardService } from '../services/board/saveBoard';
import { BoardListService } from '../services/board/boardList';
import { BoardIdInfoDto } from '../interfaces/board/IdInfo';
import { boardDto, modifiedBoardDto } from '../interfaces/board/board';
import {
  ListDto,
  UserListDto,
  BoardCommentListDto
} from '../interfaces/board/listDto';
import { upload } from '../middleware/multer';
import { checkWriter } from '../middleware/checkWriter';
import { SaveNotificationService } from '../services/Notification/saveNotifications';
import {
  ListResponse,
  SingleNotificationResponse,
  UserListResponse
} from '../interfaces/response';
import { BoardCommentListService } from '../services/comment/boardCommentList';
import { stripHtmlTags } from '../utils/string/stripHtmlTags';
import {
  BOARD_TITLE_MAX,
  TAG_NAME_MAX,
  USER_NICKNAME_MAX
} from '../constants/validation';
import { validateFieldByteLength } from '../utils/validation/validateFieldByteLength ';
import { handleError } from '../utils/errHandler';
import { UnauthorizedError } from '../errors/unauthorizedError';
import { resizeImage } from '../middleware/resizeImage';
import { S3DirectoryName } from '../constants/s3/s3DirectoryName';

export const boardRouter = Router();

// 게시글 리스트 조회 (GET : /board/list?sort=&tag=&cursor=&page-size=&is-before=)
boardRouter.get(
  '/list',
  validate([
    query('sort')
      .optional({ checkFalsy: true })
      .isIn(['like', 'view'])
      .withMessage(
        'sort의 값이 존재한다면 like, view 중 하나의 값이어야합니다.'
      ),
    query('query').optional({ checkFalsy: true }).isString(),
    query('tag')
      .optional({ checkFalsy: true })
      .isString()
      .custom((value) => validateFieldByteLength('태그', value, TAG_NAME_MAX)),
    query('cursor')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i),
    query('page')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
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
  async (req: Request, res: Response) => {
    try {
      const listDto: ListDto = {
        query: req.query.query as string,
        sort: req.query.sort as string,
        tag: req.query.tag as string,
        cursor: req.query.cursor as string,
        page: req.query.page as unknown as number,
        pageSize: req.query['page-size'] as unknown as number,
        isBefore: req.query['is-before'] === 'true' ? true : false
      };
      const result: ListResponse = await BoardListService.getList(listDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        total: result.total,
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 특정 유저의 게시글 리스트 반환 (GET : /board/list/:{nickname}?sort=&tag=&cursor=&pageSize=&categoryId=&isBefore=)
// 유저의 유니크한 값인 닉네임을 이용, 자기 자신의 게시글을 조회할 경우에만 비공개된 글까지 조회 가능
boardRouter.get(
  '/list/:nickname',
  validate([
    param('nickname').custom((nickname) =>
      validateFieldByteLength('nickname', nickname, USER_NICKNAME_MAX)
    ),
    query('query').optional({ checkFalsy: true }).isString(),
    query('sort')
      .optional({ checkFalsy: true })
      .isIn(['like', 'view'])
      .withMessage(
        'sort의 값이 존재한다면 like, view 중 하나의 값이어야합니다.'
      ),
    query('tag')
      .optional({ checkFalsy: true })
      .isString()
      .custom((value) => validateFieldByteLength('태그', value, TAG_NAME_MAX)),
    query('cursor')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i),
    query('page')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('page-size')
      .optional({ checkFalsy: true })
      .toInt() // 숫자로 전환
      .isInt({ min: 1 })
      .withMessage(
        'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
      ),
    query('category-id')
      .optional({ checkFalsy: true })
      .matches(/^(default|[0-9a-f]{32})$/i)
      .withMessage(
        '카테고리 id는 32자리의 문자열이거나 "default"이어야 합니다.'
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
      const userListDto: UserListDto = {
        query: req.query.query as string,
        sort: req.query.sort as string,
        tag: req.query.tag as string,
        cursor: req.query.cursor as string,
        page: req.query.page as unknown as number,
        pageSize: req.query['page-size'] as unknown as number,
        nickname: req.params.nickname.split(':')[1],
        userId: req.id,
        categoryId: req.query['category-id'] as string,
        isBefore: req.query['is-before'] === 'true' ? true : false
      };

      const result: UserListResponse =
        await BoardListService.getUserList(userListDto);

      return res.status(result.result ? 200 : 500).send({
        data: result.data,
        isWriter: result.isWriter,
        total: result.total,
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 특정 게시글의 댓글 조회 (GET : /board/:boardId/comments)
boardRouter.get(
  '/:boardId/comments',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('boardId')
      .matches(/^:[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.'),
    query('sort')
      .optional({ checkFalsy: true })
      .isIn(['like', 'dislike'])
      .withMessage('sort의 값이 존재한다면 "like" 또는 "dislike"이어야합니다.'),
    query('cursor')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i),
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
      const boardIdInfoDto: BoardCommentListDto = {
        userId: req.id,
        boardId: req.params.boardId.split(':')[1],
        sort: req.query.sort as string,
        pageSize: req.query['page-size'] as unknown as number,
        cursor: req.query.cursor as string,
        isBefore: req.query['is-before'] === 'true' ? true : false
      };
      const result =
        await BoardCommentListService.getTopLevelCommentsByPostId(
          boardIdInfoDto
        );
      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 데이터 조회 (GET : /board)
boardRouter.get(
  '/:boardId',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('boardId')
      .matches(/^:[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const boardIdInfo: BoardIdInfoDto = {
        userId: req.id || req.signedCookies.user,
        boardId: req.params.boardId.split(':')[1]
      };

      const result = await BoardService.getBoard(boardIdInfo);

      return res
        .status(result.result ? 200 : 500)
        .send({ data: result.data, message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 저장 ( POST : /board/new )
boardRouter.post(
  '/new',
  upload(S3DirectoryName.BOARD_IMAGE).array('uploaded_files', 10),
  resizeImage(),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('title').custom((title) =>
      validateFieldByteLength('title', title, BOARD_TITLE_MAX)
    ),
    body('content')
      .notEmpty()
      .withMessage('내용을 입력해 주세요.')
      .custom((value) => {
        const strippedContent = stripHtmlTags(value); // 유틸리티 함수 사용
        if (strippedContent.length === 0) {
          throw new Error(
            '내용에 HTML 태그를 제외한 실제 텍스트가 있어야 합니다.'
          );
        }
        return true;
      }),
    body('public').isString(), // 폼 데이터의 필드는 텍스트로 전송
    body('tagNames')
      .optional({ checkFalsy: true })
      .custom((tags) => {
        if (typeof tags === 'string') return true;

        if (!Array.isArray(tags) || tags.length > 10)
          throw new Error('태그 배열의 요소 최대 10개까지 허용됩니다.');

        tags.forEach((tag: string) => validateFieldByteLength('태그', tag, 50));

        return true;
      }),
    body('categoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 id는 32자리의 문자열이어야합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        throw new UnauthorizedError(
          req.tokenMessage || '로그인된 유저만 게시글 작성이 가능합니다.'
        );

      const boardDto: boardDto = {
        userId: req.id,
        title: req.body.title,
        content: req.body.content,
        public: req.body.public === 'false' ? false : true,
        tagNames:
          typeof req.body.tagNames === 'string'
            ? [req.body.tagNames]
            : req.body.tagNames,
        categoryId: req.body.categoryId,
        fileUrls: req.fileURL
      };

      const result: SingleNotificationResponse =
        await saveBoardService.createBoard(boardDto);

      if (result.result === true && result.notifications) {
        const notified =
          await SaveNotificationService.createMultiUserNotification(
            result.notifications
          );
        return res.status(notified.result ? 200 : 500).send(notified);
      }

      return res.status(result.result ? 200 : 500).send({
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 수정 ( PUT : /board)
boardRouter.put(
  '/',
  upload(S3DirectoryName.BOARD_IMAGE).array('uploaded_files', 10),
  resizeImage(),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('boardId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.'),
    body('title').custom((title) =>
      validateFieldByteLength('title', title, BOARD_TITLE_MAX)
    ),
    body('content')
      .notEmpty()
      .withMessage('내용을 입력해 주세요.')
      .custom((value) => {
        const strippedContent = stripHtmlTags(value);
        if (strippedContent.length === 0) {
          throw new Error(
            '내용에 HTML 태그를 제외한 실제 텍스트가 있어야 합니다.'
          );
        }
        return true;
      }),
    body('public').isString(),
    body('tagNames')
      .optional({ checkFalsy: true })
      .custom((tags) => {
        if (typeof tags === 'string') return true;

        if (!Array.isArray(tags) || tags.length > 10)
          throw new Error('태그 배열의 요소는 최대 10개까지 허용됩니다.');

        tags.forEach((tag: string) => validateFieldByteLength('태그', tag, 50));

        return true;
      }),
    body('categoryId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 id는 32자리의 문자열이어야합니다.')
  ]),
  jwtAuth,
  checkWriter(),
  async (req: Request, res: Response) => {
    try {
      if (!req.isWriter) {
        return res.status(403).send({
          message: '해당 유저가 작성한 게시글이 아닙니다.'
        });
      }

      const boardDto: modifiedBoardDto = {
        userId: req.id,
        boardId: req.body.boardId,
        title: req.body.title,
        content: req.body.content,
        public: req.body.public === 'false' ? false : true,
        tagNames:
          typeof req.body.tagNames === 'string'
            ? [req.body.tagNames]
            : req.body.tagNames,
        categoryId: req.body.categoryId,
        fileUrls: req.fileURL
      };

      const result = await saveBoardService.modifyBoard(boardDto);

      return res.status(result.result ? 200 : 500).send({
        message: result.message
      });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 삭제 ( DELETE : /board)
boardRouter.delete(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('boardId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.')
  ]),
  jwtAuth,
  checkWriter(),
  async (req: Request, res: Response) => {
    try {
      if (!req.isWriter) {
        return res.status(403).send({
          message: '해당 유저가 작성한 게시글이 아닙니다.'
        });
      }

      const boardIdInfo: BoardIdInfoDto = {
        userId: req.id,
        boardId: req.body.boardId
      };

      const result = await BoardService.deleteBoard(boardIdInfo);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 좋아요 추가( post : /board/like )
boardRouter.post(
  '/like',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('boardId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage ||
            '로그인된 유저만 게시글에 당근을 추가할 수 있습니다.'
        );
      }

      const boardIdInfoDto: BoardIdInfoDto = {
        userId: req.id,
        boardId: req.body.boardId
      };

      const result = await BoardService.addLike(boardIdInfoDto);

      if (result.result === true && result.notifications) {
        const notified =
          await SaveNotificationService.createSingleUserNotification(
            result.notifications
          );
        return res.status(notified.result ? 200 : 500).send(notified);
      }

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);

// 게시글 좋아요 취소 ( post : /board/unlike )
boardRouter.post(
  '/unlike',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('boardId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        throw new UnauthorizedError(
          req.tokenMessage ||
            '로그인된 유저만 게시글에 당근을 취소할 수 있습니다.'
        );
      }

      const boardIdInfoDto: BoardIdInfoDto = {
        userId: req.id,
        boardId: req.body.boardId
      };

      const result = await BoardService.cancelLike(boardIdInfoDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      handleError(err, res);
    }
  }
);
