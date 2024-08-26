import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { v4 as uuidv4 } from 'uuid';
import {
  CommentDto,
  CommentUpdateDto,
  CommentIdDto,
  CommentLikeDto
} from '../../interfaces/comment';
import { redis } from '../../loaders/redis';

export class commentService {
  // 댓글 생성
  static create = async (commentDto: CommentDto) => {
    try {
      // Board 테이블의 board_id에 해당하면서 deleted_at IS NULL인 데이터가 있는지 확인
      const boardCheckQuery = `SELECT 1 FROM Board WHERE board_id = ? AND deleted_at IS NULL`;
      const [boardExists] = await db.query(boardCheckQuery, [
        commentDto.boardId
      ]);

      if (!boardExists)
        return { result: false, message: '존재하지 않거나 삭제된 게시글' };

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
      // DB에서 사용자가 이미 좋아요를 눌렀는지 확인
      const [likedInDB] = await db.query(
        'SELECT comment_like FROM Comment_Like WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL',
        [commentLikeDto.commentId, commentLikeDto.userId]
      );

      if (!likedInDB) {
        // Redis에 좋아요 캐시 추가 ( DB에 없을 때만 추가 )
        const likedInRedis = await redis.hset(
          `comment_like:${commentLikeDto.commentId}`,
          commentLikeDto.userId,
          Number(commentLikeDto.isLike)
        );

        // likedInRedis가 1이면 추가 성공, 0이지만 필드가 존재하면 수정 성공
        if (
          likedInRedis === 1 ||
          (likedInRedis === 0 &&
            (await redis.hexists(
              `comment_like:${commentLikeDto.commentId}`,
              commentLikeDto.userId
            )))
        ) {
          return {
            result: true,
            message:
              likedInRedis === 1 ? '좋아요 추가 성공' : '좋아요 수정 성공'
          };
        }

        return { result: false, message: '좋아요 추가 실패 ( 캐시 실패 )' };
      }

      if (likedInDB.comment_like === commentLikeDto.isLike) {
        return {
          result: true,
          message: commentLikeDto.isLike
            ? '이미 좋아요한 댓글입니다'
            : '이미 싫어요한 댓글입니다'
        };
      }
      // likedInDB.comment_like !== commentLikeDto.isLike
      const query = `INSERT INTO Comment_Like (comment_id, user_id, comment_like) VALUES (?,?,?) 
                     ON DUPLICATE KEY UPDATE comment_like = ?, deleted_at = NULL`;
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

  static unlike = async (commentIdDto: CommentIdDto) => {
    try {
      // Redis에서 캐시 확인 후 삭제 시도
      const isCashed = await redis.hdel(
        `comment_like:${commentIdDto.commentId}`,
        commentIdDto.userId
      );

      if (isCashed === 1)
        return { result: true, message: '캐시된 댓글 좋아요/싫어요 삭제 성공' };

      // 캐시에서 삭제되지 않았을 경우 DB에서 삭제 시도
      const query = `
      UPDATE Comment_Like 
      SET deleted_at = CURRENT_TIMESTAMP 
      WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL`;
      const params = [commentIdDto.commentId, commentIdDto.userId];

      const { affectedRows: deletedLikeCount } = await db.query(query, params);

      return deletedLikeCount > 0
        ? { result: true, message: '댓글 좋아요/싫어요 삭제 성공' }
        : { result: false, message: '댓글 좋아요/싫어요 삭제 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
