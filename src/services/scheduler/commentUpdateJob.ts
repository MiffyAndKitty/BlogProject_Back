import { redis } from '../../loaders/redis';
import { db } from '../../loaders/mariadb';

export class CommentUpdateJobService {
  static async updateComment(keyname: 'comment_like'): Promise<boolean> {
    try {
      let isSuccess: boolean = true;
      let cursor = '0';

      do {
        const [nextCursor, keys] = await redis.scan(
          cursor,
          'MATCH',
          `${keyname}:*`,
          'COUNT',
          100
        );
        cursor = nextCursor;

        for (const key of keys) {
          const commentId = key.split(':')[1];
          const allFields = await redis.hgetall(key);

          let totalLikes = 0;
          let totalDislikes = 0;

          for (const [userId, likeStatus] of Object.entries(allFields)) {
            try {
              const query = `
                INSERT INTO Comment_Like (comment_id, user_id, comment_like) VALUES (?,?,?) 
                ON DUPLICATE KEY UPDATE comment_like = ?, deleted_at = NULL`;

              const updated = await db.query(query, [
                commentId,
                userId,
                likeStatus === '1' ? 1 : 0,
                likeStatus === '1' ? 1 : 0
              ]);

              if (updated.affectedRows === 1) {
                likeStatus === '1' ? (totalLikes += 1) : (totalDislikes += 1);
                await redis.unlink(key);
              } else {
                console.log(
                  `Comment_Like 테이블 업데이트 실패: user_id=${userId}, comment_id=${commentId}`
                );
                isSuccess = false;
              }
            } catch (err: any) {
              console.error(
                `Comment_Like 테이블 업데이트 중 오류 발생: user_id=${userId}, comment_id=${commentId}`,
                err
              );
              isSuccess = false;
            }
            continue; // 오류 발생 시 다음 userId로 넘어감
          }

          // 총 좋아요 또는 싫어요 수를 Comment 테이블에 한 번에 업데이트
          let commentQuery;
          if (totalLikes > 0) {
            commentQuery = `
              UPDATE Comment
              SET comment_like = comment_like + ?
              WHERE comment_id = ?`;
            await db.query(commentQuery, [totalLikes, commentId]);
            console.log(
              `Comment 테이블에 ${totalLikes}개의 좋아요가 추가되었습니다: comment_id=${commentId}`
            );
          }
          if (totalDislikes > 0) {
            commentQuery = `
              UPDATE Comment
              SET comment_dislike = comment_dislike + ?
              WHERE comment_id = ?`;
            await db.query(commentQuery, [totalDislikes, commentId]);
            console.log(
              `Comment 테이블에 ${totalDislikes}개의 싫어요가 추가되었습니다: comment_id=${commentId}`
            );
          }
        }
      } while (cursor !== '0');

      return isSuccess;
    } catch (err) {
      console.log(`${keyname} 업데이트 중 전체적인 오류 발생:`, err);
      return false;
    }
  }
}
