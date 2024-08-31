import schedule from 'node-schedule';
import { redis } from '../redis';
import { db } from '../mariadb';

const scheduleConfig = {
  hour: 0,
  minute: 0,
  tz: 'Asia/Seoul'
};

const updateBoard = async (keyname: 'board_view' | 'board_like') => {
  try {
    const keys = await redis.keys(`${keyname}:*`);
    for (const key of keys) {
      const boardId = key.split(':')[1];
      const count = await redis.scard(key);

      if (count <= 0) {
        continue;
      }

      const updated = await db.query(
        `UPDATE Board SET ${keyname} = ${keyname} + ? WHERE board_id = ?`,
        [count, boardId]
      );

      if (updated.affectedRows > 0) {
        const deletedCashed = await redis.del(key);
      }
    }
    return true;
  } catch (err) {
    console.log(`${keyname} 업데이트 중 오류 발생:`, err);
    return false;
  }
};

const updateCommentLike = async (keyname: 'comment_like') => {
  try {
    // Redis에서 모든 해시 키를 조회
    const keys = await redis.keys(`${keyname}:*`);

    for (const key of keys) {
      const commentId = key.split(':')[1];
      const allFields = await redis.hgetall(key);

      for (const [userId, likeStatus] of Object.entries(allFields)) {
        const query = `
        INSERT INTO Comment_Like (comment_id, user_id, comment_like) VALUES (?,?,?) 
        ON DUPLICATE KEY UPDATE comment_like = ?, deleted_at = NULL`;

        const updated = await db.query(query, [
          commentId,
          userId,
          likeStatus ? 1 : 0,
          likeStatus ? 1 : 0
        ]);

        // Comment 테이블 업데이트 (likeStatus에 따라 comment_like 또는 comment_dislike 필드를 업데이트)
        let commentQuery;
        if (likeStatus === '1') {
          commentQuery = `
            UPDATE Comment
            SET comment_like = comment_like + 1
            WHERE comment_id = ?`;
        } else if (likeStatus === '0') {
          commentQuery = `
            UPDATE Comment
            SET comment_dislike = comment_dislike + 1
            WHERE comment_id = ?`;
        }

        // Comment 테이블 업데이트 쿼리 실행
        if (commentQuery) {
          const commentUpdated = await db.query(commentQuery, [commentId]);

          if (commentUpdated.affectedRows > 0) {
            console.log(
              `Comment 테이블 업데이트 성공: comment_id=${commentId}, likeStatus=${likeStatus}`
            );
          } else {
            console.log(
              `Comment 테이블 업데이트 실패: comment_id=${commentId}, likeStatus=${likeStatus}`
            );
          }
        }

        if (updated.affectedRows > 0) {
          console.log(
            `Comment_Like 테이블 업데이트 성공: user_id=${userId}, comment_id=${commentId}`
          );
        } else {
          console.log(
            `Comment_Like 테이블 업데이트 실패: user_id=${userId}, comment_id=${commentId}`
          );
        }
      }
    }
    return true;
  } catch (err) {
    console.error('DB 업데이트 중 오류 발생:', err);
    return false;
  }
};

const periodicUpdate = async () => {
  try {
    console.log(
      '[24시간 마다 실행] 조회수/좋아요수 DB에 업데이트 : ',
      new Date()
    );
    (await updateBoard('board_view'))
      ? console.log('게시글 조회수 업데이트 성공')
      : console.log('게시글 조회수 업데이트 실패');

    (await updateBoard('board_like'))
      ? console.log('게시글 좋아요 업데이트 성공')
      : console.log('게시글 좋아요 업데이트 실패');

    (await updateCommentLike('comment_like'))
      ? console.log('댓글 좋아요 업데이트 성공')
      : console.log('댓글 좋아요 업데이트 실패');
  } catch (err) {
    console.log('조회수/좋아요수 DB에 업데이트 중 오류 발생:', err);
  }
};

export const boardUpdateJob = schedule.scheduleJob(
  scheduleConfig,
  periodicUpdate
);
