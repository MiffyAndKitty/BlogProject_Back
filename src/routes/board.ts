import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body, param, query } from 'express-validator';
import { ensureError } from '../errors/ensureError';
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
import { saveNotificationService } from '../services/Notification/saveNotifications';
import {
  ListResponse,
  SingleNotificationResponse,
  UserListResponse
} from '../interfaces/response';
import { BoardCommentListService } from '../services/comment/boardCommentList';

export const boardRouter = Router();

// 게시글 리스트 조회
// GET : /board/list?sort=&tag=&cursor=&page-size=&is-before=
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
    query('tag').optional({ checkFalsy: true }).isString(),
    query('cursor').optional({ checkFalsy: true }).isString(),
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
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 유저의 유니크한 값인 닉네임을 이용하여 특정 유저의 게시글 리스트 반환
// 자기 자신의 게시글을 조회할 경우에만 비공개된 글까지 조회 가능
// GET : /board/list/:{nickname}?sort=&tag=&cursor=&pageSize=&categoryId=&isBefore=
boardRouter.get(
  '/list/:nickname',
  validate([
    param('nickname').isString(),
    query('query').optional({ checkFalsy: true }).isString(),
    query('sort')
      .optional({ checkFalsy: true })
      .isIn(['like', 'view'])
      .withMessage(
        'sort의 값이 존재한다면 like, view 중 하나의 값이어야합니다.'
      ),
    query('tag').optional({ checkFalsy: true }).isString(),
    query('cursor').optional({ checkFalsy: true }).isString(),
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
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
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
    query('cursor').optional({ checkFalsy: true }).isString(),
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
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 게시글 데이터 조회 ( GET : /board)
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

      // 게시글 데이터 조회 서비스 호출
      const result = await BoardService.getBoard(boardIdInfo);

      return res
        .status(result.result ? 200 : 500)
        .send({ data: result.data, message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 게시글 저장 ( POST : /board/new )
boardRouter.post(
  '/new',
  upload('board').array('uploaded_files', 10),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('title').notEmpty(),
    body('content').notEmpty(),
    body('public').isString(), // 폼 데이터의 필드는 텍스트로 전송
    body('tagNames')
      .optional({ checkFalsy: true })
      .isArray()
      .custom((tags) => {
        if (tags.length > 10) {
          throw new Error('태그는 최대 10개까지 허용됩니다.');
        }
        return true;
      }),
    body('categoryId')
      .optional({ checkFalsy: true }) //빈 문자열, null, undefined 등)이면 검사를 건너뛴다
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('카테고리 id는 32자리의 문자열이어야합니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id)
        return res
          .status(401)
          .send({ message: req.tokenMessage || '게시글 저장 권한 없음' });

      const fileUrls: Array<string> = [];

      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          if ('location' in file && typeof file.location === 'string') {
            fileUrls.push(file.location);
          }
        });
      }

      const boardDto: boardDto = {
        userId: req.id,
        title: req.body.title,
        content: req.body.content,
        public: req.body.public === 'false' ? false : true,
        tagNames: req.body.tagNames || [],
        categoryId: req.body.categoryId,
        fileUrls: fileUrls
      };

      const result: SingleNotificationResponse =
        await saveBoardService.createBoard(boardDto);

      if (result.result === true && result.notifications) {
        const notified =
          await saveNotificationService.createMultiUserNotification(
            result.notifications
          );
        return notified.result
          ? res.status(200).send(notified)
          : res.status(500).send(notified);
      }

      return res.status(result.result ? 200 : 500).send({
        message: result.message
      });
    } catch (err) {
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 게시글 수정 ( PUT : /board)
boardRouter.put(
  '/',
  upload('board').array('uploaded_files', 10),
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    body('boardId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 게시글 id가 아닙니다.'),
    body('title').notEmpty(),
    body('content').notEmpty(),
    body('public').isString(),
    body('tagNames')
      .optional({ checkFalsy: true })
      .isArray()
      .custom((tags) => {
        if (tags.length > 10) {
          throw new Error('태그는 최대 10개까지 허용됩니다.');
        }
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
      // 작성자와 동일하지 않은 경우
      if (!req.isWriter) {
        return res.status(403).send({
          message: '해당 유저가 작성한 게시글이 아닙니다.'
        });
      }

      const fileUrls: Array<string> = [];

      if (Array.isArray(req.files)) {
        req.files.forEach((file) => {
          if ('location' in file && typeof file.location === 'string') {
            fileUrls.push(file.location);
          }
        });
      }
      const boardDto: modifiedBoardDto = {
        userId: req.id,
        boardId: req.body.boardId,
        title: req.body.title,
        content: req.body.content,
        public: req.body.public === 'false' ? false : true,
        tagNames: req.body.tagNames || [],
        categoryId: req.body.categoryId,
        fileUrls: fileUrls
      };

      const result = await saveBoardService.modifyBoard(boardDto);

      return res.status(result.result ? 200 : 500).send({
        message: result.message
      });
    } catch (err) {
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
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
      // 작성자와 동일하지 않은 경우
      if (!req.isWriter) {
        return res.status(403).send({
          message: '해당 유저가 작성한 게시글이 아닙니다.'
        });
      }

      const boardIdInfo: BoardIdInfoDto = {
        userId: req.id,
        boardId: req.body.boardId
      };

      // 게시글 삭제 서비스 호출
      const result = await BoardService.deleteBoard(boardIdInfo);

      // 삭제 결과 전송
      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
    }
  }
);

// 게시글 좋아요 추가( post : /board/like/add )
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
        return res.status(403).send({
          message:
            '로그인 하지 않은 유저는 게시글에 좋아요를 추가할 수 없습니다. '
        });
      }

      const boardIdInfoDto: BoardIdInfoDto = {
        userId: req.id,
        boardId: req.body.boardId
      };

      const result = await BoardService.addLike(boardIdInfoDto);

      return res
        .status(result.result ? 200 : 500)
        .send({ message: result.message });
    } catch (err) {
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
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
        return res.status(403).send({
          message:
            '로그인 하지 않은 유저는 게시글에 좋아요를 취소할 수 없습니다. '
        });
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
      const error = ensureError(err);
      console.error(error);
      return res.status(500).send({ message: error.message });
    }
  }
);
