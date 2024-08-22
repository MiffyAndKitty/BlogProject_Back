import schedule from 'node-schedule';
import { redis } from '../redis';
import { db } from '../mariadb';

const scheduleConfig = {
  hour: 0,
  minute: 0,
  tz: 'Asia/Seoul'
};

const updateToDB = async (keyname: string) => {
  try {
    const keys = await redis.keys(`${keyname}:*`); // 'board_view:*' 또는 'board_like:*'
    for (const key of keys) {
      const boardId = key.split(':')[1];
      const count = await redis.scard(key);

      if (count <= 0) {
        console.log('업데이트 할 캐시된 조회수가 없음');
        return false;
      }

      const updated = await db.query(
        `UPDATE Board SET ${keyname} = ${keyname} + ? WHERE board_id = ? AND deleted_at IS NULL`,
        [count, boardId]
      );

      console.log(`[ db ] Board ID ${boardId} 업데이트 완료 결과 : `, updated);

      if (updated.affectedRows > 0) {
        const deletedCashed = await redis.del(key);
        console.log(
          '[ redis ] Board ID ${boardId} 캐시된 key 삭제 : ',
          deletedCashed
        );
      }

      /*
      // 업데이트된 결과를 확인하기 위한 SELECT 쿼리 
      const [updatedResult] = await db.query(
        `SELECT ${keyname} FROM Board WHERE board_id = ? AND deleted_at IS NULL;`,
        [boardId]
      );

      console.log(`[ db ] Board ID ${boardId} 조회 결과 : `, updatedResult);
      */
    }
    return true;
  } catch (err) {
    console.log(`${keyname} 업데이트 중 오류 발생:`, err);
    return false;
  }
};

const periodicUpdate = async () => {
  try {
    console.log(
      '[24시간 마다 실행] 조회수/좋아요수 DB에 업데이트 : ',
      new Date()
    );
    (await updateToDB('board_view'))
      ? console.log('조회수 업데이트 성공')
      : console.log('조회수 업데이트 실패');

    (await updateToDB('board_like'))
      ? console.log('좋아요 업데이트 성공')
      : console.log('좋아요 업데이트 실패');
  } catch (err) {
    console.log('조회수/좋아요수 DB에 업데이트 중 오류 발생:', err);
  }
};

export const boardUpdateJob = schedule.scheduleJob(
  scheduleConfig,
  periodicUpdate
);
