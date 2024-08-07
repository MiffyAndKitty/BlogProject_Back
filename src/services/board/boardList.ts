import { db } from '../../loaders/mariadb';
import { redis } from '../../loaders/redis';
import { ensureError } from '../../errors/ensureError';
import { ListDto, UserListDto } from '../../interfaces/board/listDto';
import { BoardInDBDto } from '../../interfaces/board/boardInDB';

export class BoardListService {
  static getList = async (listDto: ListDto) => {
    try {
      let query = ``;
      const params: (string | string[] | number)[] = [];

      if (listDto.tag) {
        const tag = BoardListService._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      query += ' WHERE Board.deleted_at IS NULL AND Board.board_public = TRUE'; // 공개 게시글이면서 삭제되지 않은 글

      if (listDto.query) {
        const queryValue = decodeURIComponent(listDto.query);
        query += ` AND (board_title LIKE '%${queryValue}%' OR board_content LIKE '%${queryValue}%')`;
      }

      const [countResult] = await db.query(
        `  SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );

      if (listDto.cursor) {
        const [boardByCursor] = await db.query(
          `SELECT created_at, board_order, board_like, board_view FROM Board WHERE board_id = ?`,
          [listDto.cursor]
        );

        if (!boardByCursor) {
          throw new Error('커서에 해당하는 게시글 id가 유효하지 않습니다.');
        }

        const cursor = BoardListService._AddCursorCondition(
          boardByCursor,
          listDto.sort,
          listDto.isBefore
        );
        query += cursor.query;
        params.push(...cursor.params);
      } else {
        // 커서가 없는 경우 : 좋아요순, 조회수순, 최신순으로 정렬
        query +=
          listDto.sort === 'like' || listDto.sort === 'view'
            ? ` ORDER BY Board.board_${listDto.sort} DESC, Board.created_at DESC, Board.board_order DESC  LIMIT ?`
            : ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
      }
      const pageSize = listDto.pageSize || 10;
      params.push(pageSize);

      let data = await db.query(
        `SELECT DISTINCT Board.*, User.user_nickname, Board_Category.category_name 
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
          query,
        params
      );
      data = await BoardListService._reflectCashed(data);

      if (listDto.cursor && listDto.isBefore === true) {
        //커서가 있고, 이전 페이지를 조회하는 경우
        data = data.reverse();
      }

      // console.log('게시글 리스트 query :', query);
      // console.log('게시글 리스트 params :', params);

      // 총 글의 개수 계산
      const totalCount = Number(countResult.totalCount.toString());

      // 총 페이지 수
      const totalPageCount = Math.ceil(totalCount / pageSize);

      if (data.length >= 0) {
        return {
          result: true,
          data: data,
          total: {
            totalCount: totalCount,
            totalPageCount: totalPageCount
          },
          message: '게시글 리스트 데이터 조회 성공'
        };
      } else {
        return {
          result: false,
          data: null,
          total: null,
          message: '게시글 리스트 데이터 조회 실패'
        };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return {
        result: false,
        data: null,
        total: null,
        message: error.message
      };
    }
  };

  static getUserList = async (listDto: UserListDto) => {
    try {
      let query = ``;
      const params: (string | string[] | number)[] = [];

      if (listDto.tag) {
        const tag = BoardListService._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      const [writer] = await db.query(
        // 검색 대상인 유저를 찾음
        'SELECT user_id FROM User WHERE user_nickname = ? LIMIT 1;',
        decodeURIComponent(listDto.nickname)
      );
      // 특정 user의 게시글이면서 삭제되지 않은 글
      query += ` WHERE Board.deleted_at IS NULL AND Board.user_id = ?`;
      params.push(writer.user_id);

      let isWriter = true;
      // 작성자와 동일하지 않은 경우 공개 게시글만 보여주도록 제한
      if (writer.user_id !== listDto.userId) {
        query += ' AND Board.board_public = TRUE';
        isWriter = false;
      }

      if (listDto.categoryId) {
        const [category] = await db.query(
          `SELECT category_id FROM Board_Category WHERE category_id = ? AND user_id =? AND deleted_at IS NULL;`,
          [listDto.categoryId, writer.user_id]
        );

        if (!category) {
          throw new Error(
            '해당 닉네임을 소유한 유저가 생성한 카테고리가 아니거나 삭제된 카테고리입니다.'
          );
        }

        // 검색 대상 유저가 생성한 카테고리인 경우에만
        query += ` AND Board.category_id = ?`;
        params.push(category.category_id);
      }

      if (listDto.query) {
        const queryValue = decodeURIComponent(listDto.query);
        query += ` AND (board_title LIKE '%${queryValue}%' OR board_content LIKE '%${queryValue}%')`;
      }

      const [countResult] = await db.query(
        `  SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );

      // cursor(boardId)가 존재한다면
      // 이전 페이지의 마지막 board_id를 기준으로 다음 페이지 가져오기
      if (listDto.cursor) {
        const [boardByCursor] = await db.query(
          `SELECT created_at, board_order, board_like, board_view FROM Board WHERE board_id = ? AND user_id = ?`,
          [listDto.cursor, writer.user_id]
        );

        if (!boardByCursor) {
          throw new Error(
            '유효한 게시글 id가 아닙니다. 혹은, 해당 유저의 게시글이 아닙니다. '
          );
        }
        const cursor = BoardListService._AddCursorCondition(
          boardByCursor,
          listDto.sort,
          listDto.isBefore
        );
        query += cursor.query;
        params.push(...cursor.params);
      } else {
        // 커서가 없는 경우 : 좋아요순, 조회수순, 최신순으로 정렬
        query +=
          listDto.sort === 'like' || listDto.sort === 'view'
            ? ` ORDER BY Board.board_${listDto.sort} DESC, Board.created_at DESC, Board.board_order DESC  LIMIT ?`
            : ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
      }
      const pageSize = listDto.pageSize || 10;
      params.push(pageSize);

      let data = await db.query(
        `SELECT DISTINCT Board.*, User.user_nickname, Board_Category.category_name
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
          query,
        params
      );
      data = await BoardListService._reflectCashed(data);

      if (listDto.cursor && listDto.isBefore === true) {
        //커서가 있고, 이전 페이지를 조회하는 경우
        data = data.reverse();
      }

      data.isWriter = isWriter;
      // data 배열의 각 객체에 isWriter 속성을 추가
      data.forEach((item: any) => {
        item.isWriter = isWriter; // isWriter는 해당 게시글을 작성한 사용자의 고유 식별자일 것입니다.
      });

      // console.log('특정 유저의 게시글 리스트 query :', query);
      // console.log('특정 유저의 게시글 리스트 params :', params);

      const totalCount = Number(countResult.totalCount.toString());

      // 총 페이지 수
      const totalPageCount = Math.ceil(totalCount / pageSize);
      if (data.length >= 0) {
        return {
          result: true,
          data: data,
          isWriter: isWriter,
          total: {
            totalCount: totalCount,
            totalPageCount: totalPageCount
          },
          message: '특정 사용자의 게시글 리스트 데이터 조회 성공'
        };
      } else {
        return {
          result: false,
          data: null,
          isWriter: isWriter,
          total: null,
          message: '특정 사용자의 게시글 리스트 데이터 조회 실패'
        };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return {
        result: false,
        data: null,
        total: null,
        message: error.message
      };
    }
  };

  private static _AddTagCondition(boardTags: string) {
    const tags = boardTags.split(',');

    const query = ` INNER JOIN Board_Tag ON Board.board_id = Board_Tag.board_id
                AND Board.board_id IN (
                SELECT Board_Tag.board_id
                FROM Board_Tag
                WHERE Board_Tag.tag_name IN (?)
                GROUP BY Board_Tag.board_id
                HAVING COUNT(DISTINCT Board_Tag.tag_name) = ?
            )`;
    const params = [tags, tags.length]; // 태그 배열과 해당 배열의 길이를 파라미터로 추가
    return { query, params };
  }

  private static _AddCursorCondition(
    cursor: any,
    sort?: string,
    isBefore?: boolean
  ) {
    // 좋아요순 정렬일 경우 -> 해당 게시글의 좋아요 수 확인 -> 동일한 갯수의 좋아요 이면서 오래된 글이나 더 작은 좋아요 순으로, 좋아요가 0이면 최신순으로 정렬
    let query, params;

    if (sort === 'like' || sort === 'view') {
      if (isBefore === false) {
        // 다음 페이지
        // 좋아요순 정렬일 경우 : 커서의 좋아요 수와 동일한 갯수의 좋아요이면서 오래된 글-> 더 작은 좋아요 순으로, 좋아요가 0이면 최신순으로 정렬
        query = ` AND (Board.board_${sort} < ? OR (Board.board_${sort} = ? AND (Board.created_at < ? OR (Board.created_at = ? AND Board.board_order < ?))))`;
        params = [
          cursor[`board_${sort}`],
          cursor[`board_${sort}`],
          cursor.created_at,
          cursor.created_at,
          cursor.board_order
        ];
        // 이전 페이지의 마지막 board_id를 기준으로 다음 페이지 가져오기
        query += ` ORDER BY Board.board_${sort} DESC, Board.created_at DESC, Board.board_order DESC`;
      } else {
        // 이전페이지
        // 좋아요순 정렬일 경우 : 동일한 갯수의 좋아요 이면서 동일한 시간대이면 order가 더 큰 값(최신) 선택 -> 더 큰 좋아요 갯수
        query = ` AND ( (Board.board_${sort} = ?  AND (Board.created_at > ? OR (Board.created_at = ? AND Board.board_order > ?)) )  OR Board.board_${sort} > ? )`;
        params = [
          cursor[`board_${sort}`],
          cursor.created_at,
          cursor.created_at,
          cursor.board_order,
          cursor[`board_${sort}`]
        ];
        query += ` ORDER BY Board.board_${sort} ASC, Board.created_at ASC, Board.board_order ASC`;
      }
    } else {
      let inequalitySign = '<',
        order = 'DESC';

      if (isBefore === true) {
        inequalitySign = '>';
        order = 'ASC';
      }
      query = ` AND (Board.created_at ${inequalitySign} ? OR (Board.created_at = ? AND Board.board_order ${inequalitySign} ?))`;
      params = [cursor.created_at, cursor.created_at, cursor.board_order];
      query += ` ORDER BY Board.board_order ${order}, Board.created_at ${order}`;
    }
    query += ` LIMIT ?`;
    return { query, params };
  }

  private static async _reflectCashed(data: BoardInDBDto[]) {
    // 좋아요순 정렬일 경우 -> 해당 게시글의 좋아요 수 확인 -> 동일한 갯수의 좋아요 이면서 오래된 글이나 더 작은 좋아요 순으로, 좋아요가 0이면 최신순으로 정렬
    // Redis에서 조회수와 좋아요 수 가져오기

    const viewKeys = data.map(
      (board: { board_id: string }) => `board_view:${board.board_id}`
    );
    const likeKeys = data.map(
      (board: { board_id: string }) => `board_like:${board.board_id}`
    );

    for (let i = 0; i < viewKeys.length; i++) {
      const cashedCount = await redis.scard(viewKeys[i]);
      data[i].board_view += Number(cashedCount) || 0;
    }
    for (let i = 0; i < likeKeys.length; i++) {
      const cashedCount = await redis.scard(likeKeys[i]);
      data[i].board_like += Number(cashedCount) || 0;
    }

    return data;
  }
}
