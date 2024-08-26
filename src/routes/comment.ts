import { Router, Request, Response } from 'express';
import { validate } from '../middleware/express-validation';
import { header, body } from 'express-validator';
import { ensureError } from '../errors/ensureError';
import { jwtAuth } from '../middleware/passport-jwt-checker';
import { commentService } from '../services/comment/comment';
import {
  CommentDto,
  CommentIdDto,
  CommentLikeDto,
  CommentUpdateDto
} from '../interfaces/comment';

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
    body('commentContent').notEmpty().withMessage('댓글 내용은 필수입니다.'),
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
      const result = await commentService.create(commentDto);

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
    body('commentContent').notEmpty().withMessage('댓글 내용은 필수입니다.')
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
