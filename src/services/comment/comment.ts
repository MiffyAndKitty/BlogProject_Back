import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { v4 as uuidv4 } from 'uuid';
import {
  CommentDto,
  CommentUpdateDto,
  CommentIdDto,
  CommentLikeDto
} from '../../interfaces/comment';

export class commentService {
  // 댓글 생성
  static create = async (commentDto: CommentDto) => {
    try {
      const commentId = uuidv4().replace(/-/g, '');
      const query = `INSERT INTO Comment (comment_id, board_id, user_id, comment_content, parent_comment_id) VALUES (?,?,?,?,?);`;
      const params = [
        commentId,
        commentDto.boardId,
        commentDto.userId,
        commentDto.commentContent,
        commentDto.parentCommentId || null
      ];

      const { affectedRows: createdCount } = await db.query(query, params);

      return createdCount === 1
        ? { result: true, message: '댓글 생성 성공' }
        : { result: false, message: '댓글 생성 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  // 댓글 수정
  static update = async (commentUpdateDto: CommentUpdateDto) => {
    try {
      const query = `UPDATE Comment SET comment_content = ? WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL`;
      const params = [
        commentUpdateDto.commentContent,
        commentUpdateDto.commentId,
        commentUpdateDto.userId
      ];

      const { affectedRows: updatedCount } = await db.query(query, params);

      return updatedCount === 1
        ? { result: true, message: '댓글 수정 성공' }
        : { result: false, message: '댓글 수정 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  // 댓글 삭제
  static delete = async (commentIdDto: CommentIdDto) => {
    try {
      const query = `UPDATE Comment SET deleted_at = CURRENT_TIMESTAMP WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL`;
      const params = [commentIdDto.commentId, commentIdDto.userId];

      const { affectedRows: deletedCount } = await db.query(query, params);

      return deletedCount === 1
        ? { result: true, message: '댓글 삭제 성공' }
        : { result: false, message: '댓글 삭제 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  // 댓글 좋아요 또는 싫어요 추가
  static like = async (commentLikeDto: CommentLikeDto) => {
    try {
      const query = `INSERT INTO Comment_Like (comment_id, user_id, comment_like) VALUES (?,?,?) ON DUPLICATE KEY UPDATE comment_like = ?`;
      const params = [
        commentLikeDto.commentId,
        commentLikeDto.userId,
        commentLikeDto.isLike ? 1 : 0,
        commentLikeDto.isLike ? 1 : 0
      ];

      const { affectedRows: likeCount } = await db.query(query, params);

      return likeCount > 0
        ? {
            result: true,
            message: commentLikeDto.isLike
              ? '댓글 좋아요 성공'
              : '댓글 싫어요 성공'
          }
        : {
            result: false,
            message: commentLikeDto.isLike
              ? '댓글 좋아요 실패'
              : '댓글 싫어요 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  // 댓글 좋아요 또는 싫어요 삭제
  static unlike = async (commentIdDto: CommentIdDto) => {
    try {
      const query = `UPDATE Comment_Like SET deleted_at = CURRENT_TIMESTAMP WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL`;
      const params = [commentIdDto.commentId, commentIdDto.userId];

      const { affectedRows: deletedLikeCount } = await db.query(query, params);

      return deletedLikeCount === 1
        ? { result: true, message: '댓글 좋아요/싫어요 삭제 성공' }
        : { result: false, message: '댓글 좋아요/싫어요 삭제 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
