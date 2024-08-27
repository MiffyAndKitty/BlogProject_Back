import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BoardCommentListDto } from '../../interfaces/board/listDto';
import { redis } from '../../loaders/redis';

export class BoardCommentListService {
  // 특정 게시판의 최상위 댓글을 조회하고 사용자 정보와 함께 반환
  static getTopLevelCommentsByPostId = async (
    commentDto: BoardCommentListDto
  ) => {
    try {
      const sort = 'ASC'; // 작성된 순서
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
        WHERE c.board_id = ?
          AND c.parent_comment_id IS NULL -- 최상위 댓글만 선택
          AND c.deleted_at IS NULL
        ORDER BY c.comment_order ${sort};
      `;

      const comments = await db.query(query, [commentDto.boardId]);

      if (comments.length === 0) {
        return {
          result: true,
          data: [],
          total: {
            totalCount: null,
            totalPageCount: null
          },
          message: '조회된 댓글 리스트가 없습니다'
        };
      }

      // 전체 최상위 댓글 수를 계산하기 위한 쿼리
      const countQuery = `
        SELECT COUNT(*) AS totalCount
        FROM Comment
        WHERE board_id = ?
          AND parent_comment_id IS NULL -- 최상위 댓글만 포함
          AND deleted_at IS NULL;
      `;
      const [countResult] = await db.query(countQuery, [commentDto.boardId]);
      const totalCount = Number(countResult.totalCount);

      const pageSize = commentDto.pageSize || 10; // 기본 페이지 크기 설정
      const totalPageCount = Math.ceil(totalCount / pageSize);

      // Redis에서 좋아요/싫어요 수를 가져와 기존 데이터에 더함
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
            isWriter: row.user_id === commentDto.userId // 사용자가 작성한 댓글인지 여부 추가
          };
        })
      );

      // 좋아요 정렬 수행
      if (commentDto.sort === 'like') {
        parsedComments.sort((a, b) => {
          const likeDiff = b.likes - a.likes;
          return likeDiff !== 0 ? likeDiff : b.comment_order - a.comment_order; // 좋아요수가 같으면 최신순으로 정렬
        });
      }

      // 커서가 있는 경우, isBefore 값에 따라 해당 커서의 값 앞 또는 뒤부터 댓글을 필터링하여 반환
      // 커서가 없는 경우, pageSize 만큼 데이터를 반환
      if (!commentDto.cursor) {
        const paginatedComments = parsedComments.slice(0, pageSize);

        return {
          result: true,
          data: paginatedComments,
          total: {
            totalCount: totalCount,
            totalPageCount: totalPageCount
          },
          message: '댓글 리스트 조회 성공'
        };
      }

      const cursorIndex = parsedComments.findIndex(
        (comment) => comment.comment_id === commentDto.cursor
      );

      if (cursorIndex !== -1) {
        const paginatedComments = commentDto.isBefore
          ? parsedComments.slice(
              Math.max(0, cursorIndex - pageSize),
              cursorIndex
            )
          : parsedComments.slice(cursorIndex + 1, cursorIndex + 1 + pageSize);

        return {
          result: true,
          data: paginatedComments,
          total: {
            totalCount: totalCount,
            totalPageCount: totalPageCount
          },
          message: '댓글 리스트 조회 성공'
        };
      } else {
        // cursor에 해당하는 댓글이 없을 경우, 빈 배열 반환
        return {
          result: false,
          data: [],
          message: '해당 커서의 댓글을 찾을 수 없습니다'
        };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
    }
  };
}