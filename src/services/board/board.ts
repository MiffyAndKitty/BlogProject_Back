import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BoardIdInfoDto } from '../../interfaces/board/IdInfo';

export class BoardService {
  static getBoard = async (boardIdInfoDto: BoardIdInfoDto) => {
    try {
      const [data] = await db.query(
        'SELECT * from Board WHERE board_id = ?  AND deleted_at IS NULL LIMIT 1',
        [boardIdInfoDto.boardId]
      );

      if (data) {
        data.isWriter = Boolean(data.user_id === boardIdInfoDto.userId);
        const tagData = await db.query(
          'SELECT tag_name FROM Board_Tag WHERE board_id = ? AND deleted_at IS NULL',
          [boardIdInfoDto.boardId]
        );
        data.tags = tagData.map((row: any) => row.tag_name);
        return {
          result: true,
          data: data,
          message: '게시글 데이터 조회 성공'
        };
      } else {
        return {
          result: false,
          data: null,
          message: '게시글 데이터 조회 실패'
        };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return {
        result: false,
        data: null,
        message: error.message
      };
    }
  };

  static deleteBoard = async (boardIdInfoDto: BoardIdInfoDto) => {
    try {
      const deleted = await db.query(
        'UPDATE Board SET deleted_at = CURRENT_TIMESTAMP  WHERE user_id = ? AND board_id = ?',
        [boardIdInfoDto.userId, boardIdInfoDto.boardId]
      );

      if (deleted.affectedRows === 1) {
        return { result: true, message: '게시글 삭제 성공' };
      } else {
        return { result: false, message: '게시글 삭제 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
