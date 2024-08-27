import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { redis } from '../../loaders/redis'; // Redis 클라이언트 가져오기
import { ParentCommentIdDto } from '../../interfaces/comment';

export class CommentListService {
  // 특정 부모 댓글의 대댓글을 조회하는 함수 (작성된 순으로 정렬)
  static getChildCommentsByParentId = async (
    commentIdDto: ParentCommentIdDto
  ) => {
    try {
      const query = `
      SELECT
        c.comment_id,
        c.comment_content,
        c.user_id,
        c.parent_comment_id,
        c.comment_order,
        c.created_at,
        u.user_email,
        u.user_nickname,
        u.user_image
      FROM Comment c
      JOIN User u ON c.user_id = u.user_id
      WHERE c.parent_comment_id = ? -- 부모 댓글 ID를 기준으로 대댓글 조회
        AND c.deleted_at IS NULL
      ORDER BY c.comment_order ASC; -- 오래된 순으로 정렬
    `;

      const comments = await db.query(query, [commentIdDto.parentCommentId]);

      if (comments.length === 0) {
        return {
          result: true,
          data: [],
          message: '조회된 대댓글이 없습니다'
        };
      }

      // Redis에서 좋아요/싫어요 수를 가져와 기존 데이터에 더하고 처리
      const parsedComments = await Promise.all(
        comments.map(async (row: any) => {
          // Redis에서 캐시된 좋아요/싫어요 수 가져오기
          const cachedVotes = await redis.hgetall(
            `comment_like:${row.comment_id}`
          );

          // 좋아요와 싫어요 카운트를 초기화
          let cachedLikes = 0;
          let cachedDislikes = 0;

          // 캐시된 모든 유저별 상태를 순회하며 좋아요(1)와 싫어요(0) 수를 계산
          for (const vote of Object.values(cachedVotes)) {
            switch (vote) {
              case '1':
                cachedLikes++;
                break;
              case '0':
                cachedDislikes++;
                break;
              default:
                break; // 다른 값은 처리하지 않음
            }
          }

          const dbLikes = Number(row.likes ?? 0);
          const dbDislikes = Number(row.dislikes ?? 0);

          // DB에서 가져온 값과 캐시에서 계산한 값을 합산
          const totalLikes = dbLikes + cachedLikes;
          const totalDislikes = dbDislikes + cachedDislikes;

          return {
            ...row,
            likes: totalLikes, // 캐시된 좋아요 수를 더한 총 좋아요 수
            dislikes: totalDislikes, // 캐시된 싫어요 수를 더한 총 싫어요 수
            comment_order: row.comment_order, // comment_order 필드를 변환된 객체에 추가
            isWriter: row.user_id === commentIdDto.userId // 사용자가 작성한 댓글인지 여부 추가
          };
        })
      );

      return {
        result: true,
        data: parsedComments,
        message: '대댓글 리스트 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
    }
  };
}
