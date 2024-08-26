import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BoardCommentListDto } from '../../interfaces/board/listDto';
import { redis } from '../../loaders/redis'; // Redis 클라이언트 가져오기

export class BoardCommentListService {
  // 특정 게시판의 댓글을 부모-자식 관계로 조회하고 사용자 정보와 level을 함께 반환
  static getCommentsByBoardId = async (commentDto: BoardCommentListDto) => {
    try {
      const query = `
      WITH RECURSIVE CommentHierarchy AS (
        SELECT -- 부모 댓글이 없는 댓글을 선택, level 필드를 0으로 설정
          c.comment_id,
          c.comment_content,
          c.user_id,
          c.parent_comment_id,
          c.comment_order,
          c.created_at,
          u.user_email,
          u.user_nickname,
          u.user_image,
          0 AS level
        FROM Comment c
        JOIN User u ON c.user_id = u.user_id
        WHERE c.board_id = ? 
          AND c.parent_comment_id IS NULL 
          AND c.deleted_at IS NULL
        
        UNION ALL
        
        SELECT -- 위의 SELECT문에서 선택된 루트 댓글의 자식 댓글을 찾아서 추가
          c.comment_id,
          c.comment_content,
          c.user_id,
          c.parent_comment_id,
          c.comment_order,
          c.created_at,
          u.user_email,
          u.user_nickname,
          u.user_image,
          ch.level + 1 AS level
        FROM Comment c
        JOIN User u ON c.user_id = u.user_id
        INNER JOIN CommentHierarchy ch ON c.parent_comment_id = ch.comment_id
        WHERE c.deleted_at IS NULL
      )

      SELECT -- 각 댓글의 좋아요, 싫어요 정보를 추가로 가져옴
        ch.comment_id,
        ch.comment_content,
        ch.user_id,
        ch.parent_comment_id,
        ch.comment_order,
        ch.created_at,
        ch.user_email,
        ch.user_nickname,
        ch.user_image,
        ch.level,
        COALESCE(likes.like_count, 0) AS likes,
        COALESCE(dislikes.dislike_count, 0) AS dislikes
      FROM CommentHierarchy ch
      LEFT JOIN (
        SELECT comment_id, COUNT(*) AS like_count
        FROM Comment_Like
        WHERE comment_like = 1
          AND deleted_at IS NULL  -- 삭제된 좋아요는 제외
        GROUP BY comment_id
      ) likes ON ch.comment_id = likes.comment_id
      LEFT JOIN (
        SELECT comment_id, COUNT(*) AS dislike_count
        FROM Comment_Like
        WHERE comment_like = 0
          AND deleted_at IS NULL  -- 삭제된 싫어요는 제외
        GROUP BY comment_id
      ) dislikes ON ch.comment_id = dislikes.comment_id 
      ORDER BY ch.level, ch.comment_order ASC -- 오래된 순으로
      LIMIT ?;
      `;
      const pageSize = commentDto.pageSize || 10;
      const comments = await db.query(query, [commentDto.boardId, pageSize]);

      // Redis에서 좋아요/싫어요 수를 가져와 기존 데이터에 더하고, 정렬을 위해 처리
      const parsedComments = await Promise.all(
        comments.map(async (row: any) => {
          // Redis에서 캐시된 좋아요/싫어요 수 가져오기 (HGETALL을 사용하여 각 댓글의 유저별 좋아요/싫어요 상태 조회)
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

          const dbLikes = Number(row.likes);
          const dbDislikes = Number(row.dislikes);

          // DB에서 가져온 값과 캐시에서 계산한 값을 합산
          const totalLikes = dbLikes + cachedLikes;
          const totalDislikes = dbDislikes + cachedDislikes;

          return {
            ...row,
            comment_id: row.comment_id,
            parent_comment_id: row.parent_comment_id,
            user_id: row.user_id,
            likes: totalLikes, // 캐시된 좋아요 수를 더한 총 좋아요 수
            dislikes: totalDislikes, // 캐시된 싫어요 수를 더한 총 싫어요 수
            comment_order: row.comment_order // comment_order 필드를 변환된 객체에 추가
          };
        })
      );

      if (parsedComments.length === 0) {
        return {
          result: true,
          data: [],
          message: '조회된 댓글 리스트가 없습니다'
        };
      }

      // 좋아요/싫어요 정렬 수행
      switch (commentDto.sort) {
        case 'like':
          parsedComments.sort((a, b) => {
            const likeDiff = b.likes - a.likes;
            return likeDiff !== 0
              ? likeDiff
              : a.comment_order - b.comment_order; // 좋아요수가 같으면 오래된순으로 정렬
          break;
        case 'dislike':
          parsedComments.sort((a, b) => {
            const dislikeDiff = b.dislikes - a.dislikes;
            return dislikeDiff !== 0
              ? dislikeDiff
              : a.comment_order - b.comment_order; 
          });
          break;
        default:
          break;
      }

      // 트리 구조로 변환
      const commentTree = this.buildCommentTree(parsedComments);

      return {
        result: true,
        data: commentTree,
        message: '댓글 리스트 조회 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: [], message: error.message };
    }
  };

  // 댓글을 트리 구조로 변환하는 함수
  static buildCommentTree(comments: any[]) {
    const commentMap: { [key: string]: any } = {};
    const roots: any[] = [];

    // 모든 댓글을 commentMap에 추가하여 comment_id를 키로 설정
    comments.forEach((comment) => {
      comment.children = [];
      commentMap[comment.comment_id] = {
        comment_id: comment.comment_id,
        comment_content: comment.comment_content,
        user_id: comment.user_id,
        user_email: comment.user_email,
        user_nickname: comment.user_nickname,
        user_image: comment.user_image,
        created_at: comment.created_at,
        level: comment.level,
        likes: comment.likes,
        dislikes: comment.dislikes, // dislikes 필드를 포함
        comment_order: comment.comment_order, // comment_order 필드를 포함
        children: []
      };
    });

    // 각 댓글을 순회하면서 부모-자식 관계를 설정
    comments.forEach((comment) => {
      if (comment.parent_comment_id) {
        const parent = commentMap[comment.parent_comment_id];
        if (parent) {
          parent.children.push(commentMap[comment.comment_id]); // 자식 댓글을 부모의 children 배열에 추가
        }
      } else {
        roots.push(commentMap[comment.comment_id]); // 부모가 없는 댓글(루트 댓글)은 roots 배열에 추가
      }
    });

    return roots;
  }
}
