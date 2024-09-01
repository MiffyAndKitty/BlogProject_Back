import { redis } from '../../loaders/redis';
import { db } from '../../loaders/mariadb';

export class BoardUpdateJobService {
  static async updateBoard(
    keyname: 'board_view' | 'board_like'
  ): Promise<boolean> {
    try {
      let isSuccess: boolean = true;
      const keys = await redis.keys(`${keyname}:*`);
      for (const key of keys) {
        const boardId = key.split(':')[1];
        const count = await redis.scard(key);

        if (count <= 0) continue;

        try {
          const updated = await db.query(
            `UPDATE Board SET ${keyname} = ${keyname} + ? WHERE board_id = ?`,
            [count, boardId]
          );

          if (updated.affectedRows > 0) {
            await redis.del(key);
          } else {
            console.log(
              `${keyname} : Board 테이블 업데이트 실패: board_id=${boardId}`
            );
            isSuccess = false;
          }
        } catch (err) {
          console.error(
            `${keyname} : Board 테이블 업데이트 중 오류 발생: board_id=${boardId}`,
            err
          );
          isSuccess = false;
        }
        continue; // 오류 발생 시 다음 userId로 넘어감
      }

      return isSuccess;
    } catch (err) {
      console.log(`${keyname} 업데이트 중 전체적인 오류 발생:`, err);
      return false;
    }
  }
}
