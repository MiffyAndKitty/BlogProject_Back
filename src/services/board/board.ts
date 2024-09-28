import { db } from '../../loaders/mariadb';
import { BoardIdInfoDto } from '../../interfaces/board/IdInfo';
import { redis } from '../../loaders/redis';
import { SingleNotificationResponse } from '../../interfaces/response';
import { parseFieldToNumber } from '../../utils/parseFieldToNumber';
import { CacheKeys } from '../../constants/cacheKeys';
import { NotificationName } from '../../constants/notificationName';
import { InternalServerError } from '../../errors/internalServerError';
import { NotFoundError } from '../../errors/notFoundError';
import { ForbiddenError } from '../../errors/forbiddenError';
import { getImageSizesFromS3 } from '../../utils/getImageSizesFromS3';

export class BoardService {
  static getBoard = async (boardIdInfoDto: BoardIdInfoDto) => {
    let [data] = await db.query(
      `SELECT Board.*, User.user_nickname , User.user_email,
      (SELECT COUNT(*) FROM Comment WHERE Comment.board_id = Board.board_id AND Comment.deleted_at IS NULL) AS board_comment
       FROM Board 
       JOIN User ON Board.user_id = User.user_id
       WHERE Board.board_id = ? AND Board.deleted_at IS NULL 
       LIMIT 1`,
      [boardIdInfoDto.boardId]
    );
    if (!data) throw new NotFoundError('존재하지 않는 게시글입니다.');

    if (!data.board_public && data.user_id !== boardIdInfoDto.userId) {
      throw new ForbiddenError('비공개 게시글 입니다.');
    }

    const imageSizes = await getImageSizesFromS3(data.board_content);
    data.imageSizes = imageSizes;

    data = parseFieldToNumber(data, 'board_comment');

    if (!data.category_id) data.category_name = '기본 카테고리';

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
  };

  static deleteBoard = async (boardIdInfoDto: BoardIdInfoDto) => {
    const deleted = await db.query(
      'UPDATE Board SET deleted_at = CURRENT_TIMESTAMP  WHERE user_id = ? AND board_id = ?',
      [boardIdInfoDto.userId, boardIdInfoDto.boardId]
    );

    if (deleted.affectedRows === 0) {
      throw new InternalServerError('게시글 삭제 에러');
    }
    return { result: true, message: '게시글 삭제 성공' };
  };

  // 사용자의 좋아요 여부 확인
  private static _isLiked = async (boardIdInfoDto: BoardIdInfoDto) => {
    let isLike = false;
    const redisKey = `${CacheKeys.BOARD_LIKE}${boardIdInfoDto.boardId}`;
    // redis에서 사용자가 좋아요를 눌렀는지 확인
    const isLikedInRedis = await redis.sismember(
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
    if (isLike == false) isLike = Boolean(isLikedInRedis);
    const likeCount = await redis.scard(redisKey);

    return { isLike: isLike, likeCount: likeCount };
  };

  // resid의 sets 자료형을 이용하여 boardId(key)에 userId(value)들을 저장
  // 캐시된 데이터들은 매일 자정이 지날 때마다 board의 view칼럼에 value들의 숫자를 더하여 저장되도록 업데이트 될 것임
  private static _addView = async (boardIdInfoDto: BoardIdInfoDto) => {
    const { boardId, userId } = boardIdInfoDto;
    const redisKey = `${CacheKeys.BOARD_VIEW}${boardId}`;

    // Redis에 조회수 +1 캐시
    if (userId) {
      const isAdded = await redis.sadd(redisKey, userId);
      isAdded === 0
        ? console.log('이미 조회한 유저')
        : console.log('처음 조회한 유저');
    }
    return await redis.scard(redisKey);
  };

  // 사용자의 좋아요 추가 -> cash -> DB
  static addLike = async (
    boardIdInfoDto: BoardIdInfoDto
  ): Promise<SingleNotificationResponse> => {
    const { boardId, userId } = boardIdInfoDto;

    // DB에서 사용자가 이미 좋아요를 눌렀는지 확인
    const [likedInDB] = await db.query(
      'SELECT 1 FROM Board_Like WHERE board_id = ? AND user_id = ? AND deleted_at IS NULL',
      [boardId, userId]
    );

    if (likedInDB)
      return { result: true, message: '이미 좋아요한 누른 게시물입니다.' };

    const [currentUser] = await db.query(
      'SELECT user_id, user_nickname, user_email, user_image From User WHERE user_id =? AND deleted_at IS NULL;',
      [userId]
    );

    const [board] = await db.query(
      'SELECT user_id, board_title From Board WHERE board_id =?;',
      [boardId]
    );

    // Redis에 좋아요 캐시 추가 ( DB에 없을 때만 추가 )
    const likedInRedis = await redis.sadd(
      `${CacheKeys.BOARD_LIKE}${boardId}`,
      currentUser.user_id
    ); // 추가될 시 1, 추가되지 않으면 0

    if (board.user_id === userId && likedInRedis === 1) {
      return { result: true, message: '자신의 게시물에 좋아요 추가 성공' };
    }

    if (likedInRedis === 0) {
      throw new InternalServerError('좋아요 추가 실패 ( 캐시 실패 )');
    }

    return {
      result: true,
      notifications: {
        recipient: board.user_id,
        type: NotificationName.BOARD_NEW_LIKE,
        trigger: {
          id: currentUser.user_id,
          nickname: currentUser.user_nickname,
          email: currentUser.user_email,
          image: currentUser.user_image
        },
        location: {
          boardId: boardId,
          boardTitle: board.board_title.substring(0, 30)
        }
      },
      message: '좋아요 추가 성공'
    };
  };

  // 사용자의 좋아요 취소 -> cash 확인 -> DB 확인
  static cancelLike = async (boardIdInfoDto: BoardIdInfoDto) => {
    const { boardId, userId } = boardIdInfoDto;

    // Redis에서 좋아요 캐시 삭제
    const isRemoved = await redis.srem(`board_like:${boardId}`, userId!); // 삭제될 시 1, 삭제되지 않으면 0

    if (isRemoved === 1) {
      // redis에서 좋아요 삭제된 경우
      return { result: true, message: '좋아요 취소 성공' };
    }

    // db에서 좋아요 삭제
    const deleted = await db.query(
      'UPDATE Board_Like SET deleted_at = CURRENT_TIMESTAMP WHERE board_id = ? AND user_id = ? AND deleted_at IS NULL',
      [boardId, userId]
    );

    if (deleted.affectedRows === 0) {
      throw new InternalServerError('좋아요 취소 실패');
    }
    return { result: true, message: '좋아요 취소 성공' };
  };
}
