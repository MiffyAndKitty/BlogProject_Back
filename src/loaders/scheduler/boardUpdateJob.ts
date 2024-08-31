import schedule from 'node-schedule';
import { redis } from '../redis';
import { db } from '../mariadb';

const scheduleConfig = {
  hour: 0,
  minute: 0,
  tz: 'Asia/Seoul'
};

const updateToDB = async (keyname: 'board_view' | 'board_like') => {
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
