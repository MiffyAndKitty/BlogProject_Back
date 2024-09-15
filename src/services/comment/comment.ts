import { db } from '../../loaders/mariadb';
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
import { CacheKeys } from '../../constants/cacheKeys';
import { NotificationName } from '../../constants/notificationName';
export class commentService {
  // 댓글 생성
  static create = async (
    commentDto: CommentDto
  ): Promise<MultipleNotificationResponse> => {
    const boardId = commentDto.boardId;
    const boardWriterQuery = `
          SELECT u.user_id, u.user_nickname, b.board_title 
          FROM Board b
          JOIN User u ON b.user_id = u.user_id
          WHERE b.board_id = ? 
            AND b.deleted_at IS NULL
          LIMIT 1;
        `;

    const [{ user_id: boardWriterId, user_nickname: boardWriterNickname }] =
      await db.query(boardWriterQuery, [boardId]);

    if (!boardWriterId)
      return { result: false, message: '존재하지 않거나 삭제된 게시글' };

    const commentId = uuidv4().replace(/-/g, '');
    const query = `INSERT INTO Comment (comment_id, board_id, user_id, comment_content, parent_comment_id) VALUES (?,?,?,?,?);`;
    const params = [
      commentId,
      boardId,
      commentDto.userId,
      commentDto.commentContent,
      commentDto.parentCommentId || null
    ];

    const { affectedRows: createdCount } = await db.query(query, params);

    if (createdCount !== 1) return { result: false, message: '댓글 생성 실패' };

    let replyToComment: NotificationDto | undefined,
      commentOnBoard: NotificationDto | undefined;

    // 1. 대댓글 알림: 부모 댓글 작성자에게만 부모 댓글에 대댓글 생성 시 알림
    if (commentDto.parentCommentId) {
      const [{ user_id: parentCommenter }] = await db.query(
        `SELECT user_id FROM Comment WHERE comment_id = ?;`,
        [commentDto.parentCommentId]
      );

      if (parentCommenter && parentCommenter !== commentDto.userId) {
        const [replier] = await db.query(
          `SELECT user_nickname, user_email, user_image FROM User WHERE user_id = ?`,
          [commentDto.userId]
        );

        const [
          { comment_content: commentContent, board_title: commentedBoardTitle }
        ] = await db.query(
          `SELECT 
              SUBSTRING(C.comment_content, 1, 30) as comment_content, 
              SUBSTRING(B.board_title, 1, 30) as board_title
            FROM Comment C
            JOIN Board B ON C.board_id = B.board_id
            WHERE C.comment_id = ?`,
          [commentId]
        );

        replyToComment = {
          recipient: parentCommenter,
          type: NotificationName.REPLY_TO_COMMENT,
          trigger: {
            id: commentDto.userId,
            nickname: replier.user_nickname,
            email: replier.user_email,
            image: replier.user_image
          },
          location: {
            boardId: boardId,
            parentCommentId: commentDto.parentCommentId,
            commentId: commentId,
            boardTitle: commentedBoardTitle,
            commentContent: commentContent,
            boardWriterNickname: boardWriterNickname
          }
        };
      }
    }
    // 2. 게시글 작성자에게 부모 댓글 알림
    else if (
      !commentDto.parentCommentId &&
      boardWriterId !== commentDto.userId
    ) {
      const [commenter] = await db.query(
        `SELECT user_nickname, user_email, user_image FROM User WHERE user_id = ?`,
        [commentDto.userId]
      );

      const [
        { comment_content: commentContent, board_title: commentedBoardTitle }
      ] = await db.query(
        `SELECT 
            SUBSTRING(C.comment_content, 1, 30) as comment_content, 
            SUBSTRING(B.board_title, 1, 30) as board_title
          FROM Comment C
          JOIN Board B ON C.board_id = B.board_id
          WHERE C.comment_id = ?`,
        [commentId]
      );

      commentOnBoard = {
        recipient: boardWriterId,
        type: NotificationName.COMMENT_ON_BOARD,
        trigger: {
          id: commentDto.userId,
          nickname: commenter.user_nickname,
          email: commenter.user_email,
          image: commenter.user_image
        },
        location: {
          boardId: boardId,
          commentId: commentId,
          boardTitle: commentedBoardTitle,
          commentContent: commentContent
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
  };

  // 댓글 수정
  static update = async (commentUpdateDto: CommentUpdateDto) => {
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
  };

  // 댓글 삭제
  static delete = async (commentIdDto: CommentIdDto) => {
    const query = `UPDATE Comment SET deleted_at = CURRENT_TIMESTAMP WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL`;
    const params = [commentIdDto.commentId, commentIdDto.userId];

    const { affectedRows: deletedCount } = await db.query(query, params);

    return deletedCount === 1
      ? { result: true, message: '댓글 삭제 성공' }
      : { result: false, message: '댓글 삭제 실패' };
  };

  // 댓글 좋아요 또는 싫어요 추가
  static like = async (commentLikeDto: CommentLikeDto) => {
    // DB에서 사용자가 이미 좋아요를 눌렀는지 확인
    const likedInDB = await db.query(
      'SELECT comment_like FROM Comment_Like WHERE comment_id = ? AND user_id = ? AND deleted_at IS NULL',
      [commentLikeDto.commentId, commentLikeDto.userId]
    );

    if (likedInDB.length === 0) {
      // Redis에 좋아요 캐시 추가 ( DB에 없을 때만 추가 )
      const likedInRedis = await redis.hset(
        `${CacheKeys.COMMENT_LIKE}${commentLikeDto.commentId}`,
        commentLikeDto.userId,
        Number(commentLikeDto.isLike)
      );

      // likedInRedis가 1이면 추가 성공, 0이지만 필드가 존재하면 수정 성공
      if (
        likedInRedis === 1 ||
        (likedInRedis === 0 &&
          (await redis.hexists(
            `${CacheKeys.COMMENT_LIKE}${commentLikeDto.commentId}`,
            commentLikeDto.userId
          )))
      ) {
        return {
          result: true,
          message: likedInRedis === 1 ? '좋아요 추가 성공' : '좋아요 수정 성공'
        };
      }

      return { result: false, message: '좋아요 추가 실패 ( 캐시 실패 )' };
    }

    if (Boolean(likedInDB[0].comment_like) === commentLikeDto.isLike) {
      return {
        result: true,
        message: commentLikeDto.isLike
          ? '이미 좋아요한 댓글입니다'
          : '이미 싫어요한 댓글입니다'
      };
    }
    // 사용자가 좋아요/싫어요를 눌렀을 때, 데이터베이스에는 반대되는 상태가 저장된 경우 처리
    const query = `INSERT INTO Comment_Like (comment_id, user_id, comment_like) VALUES (?,?,?) 
                     ON DUPLICATE KEY UPDATE comment_like = ?, deleted_at = NULL`;
    const params = [
      commentLikeDto.commentId,
      commentLikeDto.userId,
      commentLikeDto.isLike ? 1 : 0,
      commentLikeDto.isLike ? 1 : 0
    ];

    const { affectedRows: updatedLike } = await db.query(query, params);

    if (updatedLike === 0) {
      return {
        result: false,
        message: '댓글 좋아요 실패'
      };
    }

    const updateLikeQuery = commentLikeDto.isLike
      ? `UPDATE Comment SET comment_like = comment_like + 1, comment_dislike = comment_dislike - 1 WHERE comment_id = ?`
      : `UPDATE Comment SET comment_like = comment_like - 1, comment_dislike = comment_dislike + 1 WHERE comment_id = ?`;

    // 좋아요 또는 싫어요 추가 시 Comment 테이블의 필드를 업데이트
    const { affectedRows: updatedLikeCounts } = await db.query(
      updateLikeQuery,
      [commentLikeDto.commentId]
    );

    return updatedLikeCounts > 0
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
  };

  static unlike = async (commentIdDto: CommentIdDto) => {
    // Redis에서 캐시 확인 후 삭제 시도
    const isCashed = await redis.hdel(
      `${CacheKeys.COMMENT_LIKE}${commentIdDto.commentId}`,
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

    if (deletedLikeCount === 0) {
      return {
        result: false,
        message: '데이터 베이스의 댓글 좋아요/싫어요 삭제 실패'
      };
    }
    // 방금 업데이트된 레코드 조회
    const [{ comment_like: isLiked }] = await db.query(
      `SELECT comment_like 
        FROM Comment_Like 
        WHERE comment_id = ? AND user_id = ? AND deleted_at IS NOT NULL`,
      params
    );

    // UPDATE Comment SET comment_like -1 또는 comment_dislike -1 WHERE comment_id =?
    const { affectedRows: updatedLikeCount } = await db.query(
      `UPDATE Comment 
        SET ${isLiked ? 'comment_like = comment_like - 1' : 'comment_dislike = comment_dislike - 1'}
        WHERE comment_id = ?`,
      params
    );

    return updatedLikeCount > 0
      ? { result: true, message: '댓글 좋아요/싫어요 삭제 성공' }
      : { result: false, message: '댓글 좋아요/싫어요 삭제 실패' };
  };
}
