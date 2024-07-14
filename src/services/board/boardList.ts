import { db } from '../../loaders/mariadb';
import { ensureError } from '../../errors/ensureError';
import { ListDto, UserListDto } from '../../interfaces/board/listDto';

export class BoardListService {
  static getList = async (listDto: ListDto) => {
    try {
      let query = `SELECT DISTINCT Board.* FROM Board`;
      const params: (string | string[] | number)[] = [];

      if (listDto.tag) {
        const tag = BoardListService._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      query += ' WHERE Board.deleted_at IS NULL AND Board.board_public = TRUE'; // 공개 게시글이면서 삭제되지 않은 글

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
          listDto.sort
        );
        query += cursor.query;
        params.push(...cursor.params);
      }

      const order = BoardListService._AddOrderCondition(
        listDto.sort,
        listDto.pageSize
      );
      query += order.query;
      params.push(order.params);

      const data = await db.query(query, params);

      console.log('게시글 리스트 query :', query);
      console.log('게시글 리스트 params :', params);

      // 총 글의 개수 계산
      const [countResult] = await db.query(
        `SELECT COUNT(*) AS total_count FROM Board WHERE Board.deleted_at IS NULL AND Board.board_public = TRUE;`
      );
      const totalCount = Number(countResult.total_count.toString());

      // 총 페이지 수
      const totalPageCount = Math.ceil(totalCount / order.params);

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
      let query = `SELECT DISTINCT Board.* FROM Board`;
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

      // listDto.categoryId가 존재하고, 앞자리가 '0', '1', '2' 중 하나인 경우 해당 문자를 반환, 그렇지 않으면 기본값 '-1' 반환
      const level = listDto.categoryId?.charAt(0) || -1;

      if (Number(level) >= 0) {
        const [category] = await db.query(
          `SELECT category_id FROM Board_Category${Number(level)} WHERE category_id = ? AND user_id =? AND deleted_at IS NULL;`,
          [listDto.categoryId, writer.user_id]
        );

        if (!category) {
          throw new Error(
            '해당 닉네임을 소유한 유저가 생성한 카테고리가 아닙니다.'
          );
        }

        // 검색 대상 유저가 생성한 카테고리인 경우에만
        query += ` AND category_id = ?`;
        params.push(category.category_id);
      }

      // cursor(boardId)가 존재한다면
      // 이전 페이지의 마지막 board_id를 기준으로 다음 페이지 가져오기
      if (listDto.cursor) {
        const [boardByCursor] = await db.query(
          `SELECT created_at, board_order, board_like, board_view FROM Board WHERE board_id = ? AND user_id = ?`,
          [listDto.cursor, writer.user_id]
        );

        if (!boardByCursor) {
          throw new Error(
            '유효한 게시글 id가 아닙니다. 혹은, 특정 유저의 게시글 리스트 조회 시 해당 유저의 게시글이 아닙니다. '
          );
        }
        const cursor = BoardListService._AddCursorCondition(
          boardByCursor,
          listDto.sort
        );
        query += cursor.query;
        params.push(...cursor.params);
      }

      const order = BoardListService._AddOrderCondition(
        listDto.sort,
        listDto.pageSize
      );
      query += order.query;
      params.push(order.params);

      const data = await db.query(query, params);
      data.isWriter = isWriter;

      // data 배열의 각 객체에 isWriter 속성을 추가
      data.forEach((item: any) => {
        item.isWriter = isWriter; // isWriter는 해당 게시글을 작성한 사용자의 고유 식별자일 것입니다.
      });

      console.log('특정 유저의 게시글 리스트 query :', query);
      console.log('특정 유저의 게시글 리스트 params :', params);

      // 총 글의 개수 계산
      const [countResult] = isWriter
        ? await db.query(
            `SELECT COUNT(*) AS total_count FROM Board WHERE Board.deleted_at IS NULL AND Board.user_id = '${writer.user_id}';`
          )
        : await db.query(
            `SELECT COUNT(*) AS total_count FROM Board WHERE Board.deleted_at IS NULL AND Board.user_id = '${writer.user_id}' AND Board.board_public = TRUE ;`
          );
      const totalCount = Number(countResult.total_count.toString());

      // 총 페이지 수
      const totalPageCount = Math.ceil(totalCount / order.params);

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

  private static _AddCursorCondition(cursor: any, sort?: string) {
    // 좋아요순 정렬일 경우 -> 해당 게시글의 좋아요 수 확인 -> 동일한 갯수의 좋아요 이면서 오래된 글이나 더 작은 좋아요 순으로, 좋아요가 0이면 최신순으로 정렬
    let query, params;
    if (sort === 'like' || sort === 'view') {
      query = ` AND (Board.board_${sort} < ? OR (Board.board_${sort} = ? AND (Board.created_at < ? OR (Board.created_at = ? AND Board.board_order < ?))))`;
      params = [
        cursor[`board_${sort}`],
        cursor[`board_${sort}`],
        cursor.created_at,
        cursor.created_at,
        cursor.board_order
      ];
    } else {
      query = ` AND (Board.created_at < ? OR (Board.created_at = ? AND Board.board_order < ?))`;
      params = [cursor.created_at, cursor.created_at, cursor.board_order];
    }
    return { query, params };
  }

  private static _AddOrderCondition(sort?: string, pageSize?: number) {
    // cursor(boardId)가 존재한다면
    // 이전 페이지의 마지막 board_id를 기준으로 다음 페이지 가져오기
    let query = '';
    if (sort === 'like' || sort === 'view') {
      query += ` ORDER BY Board.board_${sort} DESC, Board.created_at DESC, Board.board_order DESC  LIMIT ?`;
    } else {
      //query += ` ORDER BY Board.created_at DESC, Board.board_order DESC  LIMIT ?`;
      query += ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
    }
    const params = pageSize || 10;

    return { query, params };
  }
}
