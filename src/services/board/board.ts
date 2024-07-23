import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { BoardIdInfoDto } from '../../interfaces/board/IdInfo';
import { redis } from '../../loaders/redis';

export class BoardService {
  static getBoard = async (boardIdInfoDto: BoardIdInfoDto) => {
    try {
      const [data] = await db.query(
        `SELECT Board.*, User.user_nickname 
       FROM Board 
       JOIN User ON Board.user_id = User.user_id
       WHERE Board.board_id = ? AND Board.deleted_at IS NULL 
       LIMIT 1`,
        [boardIdInfoDto.boardId]
      );
      if (!data) throw new Error('존재하지 않는 게시글입니다.');

      const tagData = await db.query(
        'SELECT tag_name FROM Board_Tag WHERE board_id = ? AND deleted_at IS NULL',
        [boardIdInfoDto.boardId]
      );
      data.tags = tagData.map((row: any) => row.tag_name);

      const liked = await BoardService._isLiked(boardIdInfoDto);
      data.isLike = boardIdInfoDto.userId ? liked.isLike : false;
      data.board_like += liked.likeCount;

      data.isWriter = Boolean(data.user_id === boardIdInfoDto.userId);
      data.board_view += await BoardService._addView(boardIdInfoDto);

      return {
        result: true,
        data: data,
        message: '게시글 데이터 조회 성공'
      };
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

  // 사용자의 좋아요 여부 확인
  private static _isLiked = async (boardIdInfoDto: BoardIdInfoDto) => {
    let isLike = false;
    const redisKey = `boardLike:${boardIdInfoDto.boardId}`;
    // redis에서 사용자가 좋아요를 눌렀는지 확인
    const isLikedInRedis = await redis.SISMEMBER(
      redisKey,
      String(boardIdInfoDto.userId)
    );

    // redis에 사용자 정보가 없는 경우, DB에서 사용자가 좋아요 정보를 확인
    if (!isLikedInRedis) {
      const isLikedInDB = await db.query(
        'SELECT 1 FROM Board_Like WHERE board_id = ? AND user_id = ? AND deleted_at IS NULL',
        [boardIdInfoDto.boardId, boardIdInfoDto.userId]
      );
      isLike = isLikedInDB.length > 0;
    }
    if (isLike == false) isLike = isLikedInRedis;
    const likeCount = await redis.SCARD(redisKey);

    return { isLike: isLike, likeCount: likeCount };
  };

  // resid의 sets 자료형을 이용하여 boardId(key)에 userId(value)들을 저장
  // 캐시된 데이터들은 매일 자정이 지날 때마다 board의 view칼럼에 value들의 숫자를 더하여 저장되도록 업데이트 될 것임
  private static _addView = async (boardIdInfoDto: BoardIdInfoDto) => {
    const { boardId, userId } = boardIdInfoDto;
    const redisKey = `boardView:${boardId}`;

    // Redis에 조회수 +1 캐시
    if (userId) {
      const isAdded = await redis.sAdd(redisKey, userId);
      isAdded === 0
        ? console.log('이미 조회한 유저')
        : console.log('처음 조회한 유저');

      const viewCount = await redis.SCARD(redisKey);
      return viewCount;
    }
  };
}
