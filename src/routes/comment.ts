import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body, param, query } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { commentService } from '../services/comment/comment';
import {
  CommentDto,
  CommentIdDto,
  CommentLikeDto,
  CommentUpdateDto,
  ParentCommentIdDto
} from '../interfaces/comment';
import { MultipleNotificationResponse } from '../interfaces/response';
import { SaveNotificationService } from '../services/Notification/saveNotifications';
import { CommentListService } from '../services/comment/commentList';
import { validateFieldByteLength } from '../utils/validation/validateFieldByteLength ';
import { COMMENT_CONTENT_MAX } from '../constants/validation';

export const commentRouter = Router();

// 새 댓글 생성 (POST : /comment)
commentRouter.post(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('boardId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('유효한 게시글 ID 형식이 아닙니다.'),
    body('commentContent').custom((commentContent) =>
      validateFieldByteLength(
        'commentContent',
        commentContent,
        COMMENT_CONTENT_MAX
      )
    ),
    body('parentCommentId')
      .optional({ checkFalsy: true })
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('유효한 부모 댓글 ID 형식이 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }

      const commentDto: CommentDto = {
        userId: req.id,
        boardId: req.body.boardId,
        commentContent: req.body.commentContent,
        parentCommentId: req.body.parentCommentId
      };
      const result: MultipleNotificationResponse =
        await commentService.create(commentDto);

      if (result.result === true && result.notifications) {
        // true일 때만 notifications 존재
        const promises: Promise<any>[] = [];

        if (result.notifications.replyToComment) {
          promises.push(
            SaveNotificationService.createSingleUserNotification(
              result.notifications.replyToComment
            )
          );
        }

        if (result.notifications.commentOnBoard) {
          promises.push(
            SaveNotificationService.createSingleUserNotification(
              result.notifications.commentOnBoard
            )
          );
        }

        if (promises.length === 0) return res.status(201).send(result);

        // Promise.all로 병렬 처리
        const notificationResults = await Promise.all(promises);

        // 모든 알림이 성공했는지 확인
        const allSucceeded = notificationResults.every(
          (notificationResult) => notificationResult.result === true
        );

        if (allSucceeded) {
          return res
            .status(201)
            .send({ result: true, message: '모든 알림 전송 성공' });
        } else {
          // 실패한 알림이 있으면 에러 메시지 반환
          const failedMessages = notificationResults
            .filter((notificationResult) => !notificationResult.result)
            .map(
              (notificationResult) =>
                `${notificationResult.type}: ${notificationResult.message}`
            );

          return res.status(500).send({
            result: false,
            message: `일부 알림 전송 실패: ${failedMessages.join(', ')}`
          });
        }
      }

      return res.status(result.result ? 201 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 댓글 수정 (PUT : /comment)
commentRouter.put(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('commentId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('유효한 댓글 ID가 아닙니다.'),
    body('commentContent').custom((commentContent) =>
      validateFieldByteLength(
        'commentContent',
        commentContent,
        COMMENT_CONTENT_MAX
      )
    )
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }

      const commentDto: CommentUpdateDto = {
        userId: req.id,
        commentId: req.body.commentId,
        commentContent: req.body.commentContent
      };
      const result = await commentService.update(commentDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 댓글 삭제 (DELETE : /comment)
commentRouter.delete(
  '/',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('commentId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('유효한 댓글 ID가 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }

      const commentIdDto: CommentIdDto = {
        userId: req.id,
        commentId: req.body.commentId
      };
      const result = await commentService.delete(commentIdDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 댓글 좋아요 or 싫어요 추가 (POST : /comment/like)
commentRouter.post(
  '/like',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('commentId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('유효한 댓글 ID가 아닙니다.'),
    body('isLike').isBoolean().withMessage('isLike의 값은 불린값이어야합니다')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }
      const commentLikeDto: CommentLikeDto = {
        userId: req.id,
        commentId: req.body.commentId,
        isLike: req.body.isLike
      };
      const result = await commentService.like(commentLikeDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 댓글 좋아요 or 싫어요 삭제 (DELETE : /comment/like)
commentRouter.delete(
  '/like',
  validate([
    header('Authorization')
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('토큰이 없습니다.'),
    body('commentId')
      .matches(/^[0-9a-f]{32}$/i)
      .withMessage('유효한 댓글 ID가 아닙니다.')
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      if (!req.id) {
        return res.status(401).send({
          result: false,
          message: req.tokenMessage || '유효하지 않은 토큰'
        });
      }
      const commentIdDto: CommentIdDto = {
        userId: req.id,
        commentId: req.body.commentId
      };
      const result = await commentService.unlike(commentIdDto);

      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);

// 부모 댓글의 대댓글 조회 (GET : /comment/:parentCommentId/replies)
commentRouter.get(
  '/:parentCommentId/replies',
  validate([
    header('Authorization')
      .optional({ checkFalsy: true })
      .matches(/^Bearer\s[^\s]+$/)
      .withMessage('올바른 토큰 형식이 아닙니다.'),
    param('parentCommentId')
      .matches(/^:[0-9a-f]{32}$/i)
      .withMessage('올바른 형식의 부모 댓글 id가 아닙니다.')
    //query('cursor').optional({ checkFalsy: true }).isString(),
    //query('page-size')
    //  .optional({ checkFalsy: true })
    //  .toInt() // 숫자로 전환
    //  .isInt({ min: 1 })
    //  .withMessage(
    //    'pageSize의 값이 존재한다면 null이거나 0보다 큰 양수여야합니다.'
    //  ),
    //query('is-before')
    //  .optional({ checkFalsy: true })
    //  .custom((value) => {
    //    if (value !== 'true' && value !== 'false') {
    //      throw new Error(
    //        'is-before 값이 존재한다면 true/false의 문자열이어야합니다.'
    //      );
    //    }
    //    return true;
    //  })
  ]),
  jwtAuth,
  async (req: Request, res: Response) => {
    try {
      const commentIdDto: ParentCommentIdDto = {
        userId: req.id,
        parentCommentId: req.params.parentCommentId.split(':')[1]
        //pageSize: req.query['page-size'] as unknown as number,
        //cursor: req.query.cursor as string,
        //isBefore: req.query['is-before'] === 'true' ? true : false
      };
      const result =
        await CommentListService.getChildCommentsByParentId(commentIdDto);
      return res.status(result.result ? 200 : 500).send(result);
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return res.status(500).send({ result: false, message: error.message });
    }
  }
);
