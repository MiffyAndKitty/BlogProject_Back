import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { CommentListDto } from '../../interfaces/user/userInfo';

export class UserCommentService {
  // 특정 유저가 작성한 모든 댓글 리스트와 게시글 제목 반환
  static getAllCommentsByUserId = async (commentList: CommentListDto) => {
    try {
      const pageSize = commentList.pageSize || 10; // 기본 페이지 크기 설정

      let cursorCondition = '';
      let sortOrder = 'DESC';

      if (commentList.cursor) {
        let comparisonOperator = commentList.isBefore ? '>' : '<';

        // sort가 'oldest'인 경우
        if (commentList.sort === 'oldest') {
          sortOrder = 'ASC';
          comparisonOperator = commentList.isBefore ? '<' : '>';
        }

        // 커서가 있을 경우 커서를 기준으로 앞 또는 뒤 데이터를 가져오기 위한 조건 추가
        cursorCondition = `AND c.comment_order ${comparisonOperator} (
    SELECT comment_order FROM Comment WHERE comment_id = ?
  )`;
      }

      const query = `
        SELECT 
          c.comment_id,
          c.board_id,
          c.comment_content,
          c.parent_comment_id,
          c.comment_order,
          c.created_at,
          c.updated_at,
          b.board_title AS commentedBoardTitle
        FROM 
          Comment c
        INNER JOIN 
          Board b ON c.board_id = b.board_id
        WHERE 
          c.user_id = ?
          AND c.deleted_at IS NULL
          ${cursorCondition}
        ORDER BY 
          c.comment_order ${sortOrder}
        LIMIT ?;
      `;

      let userId: string;
      if (!commentList.userId) {
        const [user] = await db.query(
          `SELECT user_id FROM User WHERE user_email = ? AND deleted_at IS NULL;`,
          [commentList.email]
        );
        if (!user)
          return {
            result: false,
            data: [],
            message: '조회할 유저가 존재하지 않습니다.'
          };
        userId = user.user_id;
      } else {
        userId = commentList.userId;
      }

      const queryParams: (number | string)[] = [userId];

      if (commentList.cursor) queryParams.push(commentList.cursor);

      queryParams.push(pageSize);

      const comments = await db.query(query, queryParams);

      // 마지막 페이지 여부 확인
      const isLastPage = comments.length < pageSize;

      return {
        result: true,
        data: comments,
        isLastPage,
        message: '댓글 리스트 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
    }
  };
}
