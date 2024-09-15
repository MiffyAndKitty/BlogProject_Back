import { db } from '../../loaders/mariadb';
import { redis } from '../../loaders/redis';
import { ParentCommentIdDto } from '../../interfaces/comment';
import { CacheKeys } from '../../constants/cacheKeys';
export class CommentListService {
  // 특정 부모 댓글의 대댓글을 조회하는 함수 (작성된 순으로 정렬)
  static getChildCommentsByParentId = async (
    commentIdDto: ParentCommentIdDto
  ) => {
    const cursorQuery = '';
    // let cursorQuery = '';
    // if (commentIdDto.cursor) {
    //   const [cursor] = await db.query(
    //     `SELECT comment_order FROM Comment WHERE comment_id = ? AND deleted_at IS NULL`,
    //     [commentIdDto.cursor]
    //   );
    //   cursorQuery += `AND c.comment_order ${commentIdDto.isBefore ? '<' : '>'} ${cursor.comment_order}`;
    //}

    const query = `
        SELECT
          c.comment_id,
          c.comment_content,
          c.user_id,
          c.parent_comment_id,
          c.comment_like,
          c.comment_dislike,
          c.comment_order,
          c.created_at,
          u.user_email,
          u.user_nickname,
          u.user_image
        FROM Comment c
        JOIN User u ON c.user_id = u.user_id
        WHERE c.parent_comment_id = ? -- 부모 댓글 ID를 기준으로 대댓글 조회
          AND c.deleted_at IS NULL
          ${cursorQuery}
        ORDER BY c.comment_order ASC -- 오래된 순으로 정렬
        -- LIMIT ?;  페이지네이션을 위한 LIMIT 제거
      `;

    // const pageSize = commentIdDto.pageSize || 30;
    const comments = await db.query(query, [
      commentIdDto.parentCommentId
      // pageSize + 1 // 페이지 크기보다 하나 더 가져와서 마지막 페이지 여부를 확인
    ]);

    // 페이지 크기보다 많이 가져왔을 경우, 마지막 페이지가 아님
    // const isLastPage = comments.length <= pageSize;

    // if (!isLastPage) {
    //   comments.pop(); // 초과된 하나의 댓글 제거
    // }

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
          `${CacheKeys.COMMENT_LIKE}${row.comment_id}`
        );

        // 좋아요와 싫어요 카운트를 초기화
        let cachedLikes = 0;
        let cachedDislikes = 0;
        let isLike = false;
        let isDislike = false;

        // 캐시된 모든 유저별 상태를 순회하며 좋아요(1)와 싫어요(0) 수를 계산
        for (const [userId, vote] of Object.entries(cachedVotes)) {
          if (vote === '1') {
            cachedLikes++;
            if (userId === commentIdDto.userId) {
              isLike = true; // 사용자가 좋아요를 했을 경우
            }
          } else if (vote === '0') {
            cachedDislikes++;
            if (userId === commentIdDto.userId) {
              isDislike = true; // 사용자가 싫어요를 했을 경우
            }
          }
        }

        const dbLikes = Number(row.comment_like ?? 0);
        const dbDislikes = Number(row.comment_dislike ?? 0);

        // DB에서 가져온 값과 캐시에서 계산한 값을 합산
        const totalLikes = dbLikes + cachedLikes;
        const totalDislikes = dbDislikes + cachedDislikes;

        return {
          ...row,
          likes: totalLikes, // 캐시된 좋아요 수를 더한 총 좋아요 수
          dislikes: totalDislikes, // 캐시된 싫어요 수를 더한 총 싫어요 수
          comment_order: row.comment_order, // comment_order 필드를 변환된 객체에 추가
          isWriter: row.user_id === commentIdDto.userId, // 사용자가 작성한 댓글인지 여부 추가
          isLike, // 사용자가 좋아요를 했는지 여부
          isDislike // 사용자가 싫어요를 했는지 여부
        };
      })
    );

    return {
      result: true,
      data: parsedComments,
      // isLastPage: isLastPage,  // 페이지네이션 관련 반환 데이터 제거
      message: '대댓글 리스트 조회 성공'
    };
  };
}
