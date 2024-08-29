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
import { MultipleNotificationResponse } from '../../interfaces/response';
import { NotificationDto } from '../../interfaces/notification';

export class commentService {
  // 댓글 생성
  static create = async (
    commentDto: CommentDto
  ): Promise<MultipleNotificationResponse> => {
    try {
      const boardCheckQuery = `SELECT user_id FROM Board WHERE board_id = ? AND deleted_at IS NULL`;
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

      if (createdCount !== 1)
        return { result: false, message: '댓글 생성 실패' };

      let replyToComment: NotificationDto | undefined,
        commentOnBoard: NotificationDto | undefined;

      // 1. 대댓글 알림
      if (commentDto.parentCommentId) {
        const [parentUser] = await db.query(
          `SELECT user_id From Comment Where comment_id =?;`,
          [commentDto.parentCommentId]
        );

        if (
          parentUser &&
          parentUser.user_id !== boardExists.user_id && // 부모 댓글 작성자가 게시글 작성자가 아닌 경우
          parentUser.user_id !== commentDto.userId // // 부모 댓글 작성자가 대댓글 작성자가 아닌 경우
        ) {
          const [triggerUser] = await db.query(
            `SELECT user_nickname, user_email, user_image FROM User WHERE user_id = ?`,
            [commentDto.userId]
          );

          const [comment] = await db.query(
            `SELECT comment_content FROM Comment WHERE comment_id = ?`,
            [commentId]
          );

          replyToComment = {
            recipient: parentUser.user_id,
            type: 'reply-to-comment',
            trigger: {
              id: commentDto.userId,
              nickname: triggerUser.user_nickname,
              email: triggerUser.user_email,
              image: triggerUser.user_image
            },
            location: {
              id: commentId,
              boardTitle: undefined,
              commentContent: comment.comment_content
            }
          };
        }
      }

      // 2. 게시글 댓글 알림
      if (boardExists.user_id !== commentDto.userId) {
        const [triggerUser] = await db.query(
          `SELECT user_nickname, user_email, user_image FROM User WHERE user_id = ?`,
          [commentDto.userId]
        );

        const [comment] = await db.query(
          `SELECT comment_content FROM Comment WHERE comment_id = ?`,
          [commentId]
        );

        const [board] = await db.query(
          `SELECT board_title FROM Board WHERE board_id = ?`,
          [commentDto.boardId]
        );

        commentOnBoard = {
          recipient: boardExists.user_id,
          type: 'comment-on-board',
          trigger: {
            id: commentDto.userId,
            nickname: triggerUser.user_nickname,
            email: triggerUser.user_email,
            image: triggerUser.user_image
          },
          location: {
            id: commentId,
            boardTitle: board.board_title,
            commentContent: comment.comment_content
          }
        };
      }
      return {
        result: true,
        notifications: {
          replyToComment: replyToComment,
          commentOnBoard: commentOnBoard
        },
        message: '댓글 생성 성공'
      };
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
