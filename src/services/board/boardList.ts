import { db } from '../../loaders/mariadb';
import { redis } from '../../loaders/redis';
import { ensureError } from '../../errors/ensureError';
import { ListDto, UserListDto } from '../../interfaces/board/listDto';
import { BoardInDBDto } from '../../interfaces/board/boardInDB';

export class BoardListService {
  static getListByASC = async (listDto: ListDto) => {
    try {
      let query = ``;
      const params: (string | string[] | number)[] = [];

      if (listDto.tag) {
        const tag = this._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      query += ' WHERE Board.deleted_at IS NULL AND Board.board_public = TRUE'; // 공개 게시글이면서 삭제되지 않은 글

      if (listDto.query) {
        const queryValue = decodeURIComponent(listDto.query);
        query += ` AND (board_title LIKE '%${queryValue}%' OR REGEXP_REPLACE(board_content, '<[^>]+>', '') LIKE '%${queryValue}%')`;
      }

      const [countResult] = await db.query(
        `  SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );
      if (listDto.sort !== 'view' && listDto.sort !== 'like') {
        if (listDto.cursor) {
          const [boardByCursor] = await db.query(
            `SELECT created_at, board_order, board_like, board_view FROM Board WHERE board_id = ?`,
            [listDto.cursor]
          );

          if (!boardByCursor) {
            throw new Error('커서에 해당하는 게시글 id가 유효하지 않습니다.');
          }

          let inequalitySign = '<',
            order = 'DESC';

          if (listDto.isBefore === true) {
            inequalitySign = '>';
            order = 'ASC';
          }
          query += ` AND (Board.created_at ${inequalitySign} ? OR (Board.created_at = ? AND Board.board_order ${inequalitySign} ?))`;
          params.push(
            boardByCursor.created_at,
            boardByCursor.created_at,
            boardByCursor.board_order
          );
          query += ` ORDER BY Board.board_order ${order}, Board.created_at ${order}`;
          query += ` LIMIT ?`;
        } else {
          // 커서가 없는 경우 : 최신순으로 정렬
          query += ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
        }
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
      data = await this._reflectCashed(data);

      if (listDto.cursor && listDto.isBefore === true) {
        //커서가 있고, 이전 페이지를 조회하는 경우
        data = data.reverse();
      }

      // 카테고리 이름이 없을 경우 "기본 카테고리"로 설정
      data = data.map((boardData: BoardInDBDto) => {
        if (!boardData.category_name) {
          boardData.category_name = '기본 카테고리';
        }
        return boardData;
      });

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

  static getListByLikeOrView = async (listDto: ListDto) => {
    try {
      let query = ``;
      const params: (string | string[] | number)[] = [];

      if (listDto.tag) {
        const tag = this._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      query += ' WHERE Board.deleted_at IS NULL AND Board.board_public = TRUE'; // 공개 게시글이면서 삭제되지 않은 글

      if (listDto.query) {
        const queryValue = decodeURIComponent(listDto.query);
        query += ` AND (board_title LIKE '%${queryValue}%' OR REGEXP_REPLACE(board_content, '<[^>]+>', '') LIKE '%${queryValue}%')`;
      }

      const [countResult] = await db.query(
        `  SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );
      // 1. 전체 게시글 반환
      let data = await db.query(
        `SELECT DISTINCT Board.*, User.user_nickname, Board_Category.category_name 
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
          query,
        params
      );
      // 2. 좋아요/ 조회수 반영
      data = await this._reflectCashed(data);

      // 3. 좋아요/조회수순으로 정렬
      if (listDto.sort === 'like') {
        data.sort(
          (a: BoardInDBDto, b: BoardInDBDto) =>
            b.board_like - a.board_like ||
            b.created_at.getTime() - a.created_at.getTime() ||
            b.board_order - a.board_order
        );
      } else if (listDto.sort === 'view') {
        data.sort(
          (a: BoardInDBDto, b: BoardInDBDto) =>
            b.board_view - a.board_view ||
            b.created_at.getTime() - a.created_at.getTime() ||
            b.board_order - a.board_order
        );
      }

      // 4. 커서, 커서 앞/뒤의 값인지(isBefore), 배열의 크기만큼 반환
      const pageSize = listDto.pageSize || 10;
      if (listDto.cursor) {
        const cursorIndex = data.findIndex(
          (item: BoardInDBDto) => item.board_id === listDto.cursor
        );

        if (cursorIndex === -1) {
          return {
            result: false,
            data: data,
            total: {
              totalCount: [],
              totalPageCount: []
            },
            message: '유효하지 않은 커서'
          };
        }

        data = listDto.isBefore
          ? data.slice(Math.max(0, cursorIndex - pageSize), cursorIndex) // 커서 이전의 데이터만 잘라서 반환
          : data.slice(cursorIndex + 1, cursorIndex + 1 + pageSize);
      } else {
        // 커서가 없는 경우, 처음부터 페이지 사이즈만큼 자르기
        data = data.slice(0, pageSize);
      }

      // 카테고리 이름이 없을 경우 "기본 카테고리"로 설정
      data = data.map((boardData: BoardInDBDto) => {
        if (!boardData.category_name) {
          boardData.category_name = '기본 카테고리';
        }
        return boardData;
      });

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

  static getUserListByASC = async (listDto: UserListDto) => {
    try {
      let query = ``;
      const params: (string | string[] | number)[] = [];

      const [writer] = await db.query(
        // 검색 대상인 유저를 찾음
        'SELECT user_id FROM User WHERE user_nickname = ? LIMIT 1;',
        decodeURIComponent(listDto.nickname)
      );

      if (!writer) {
        return {
          result: false,
          data: null,
          total: null,
          message: '검색 대상인 유저가 존재하지 않습니다'
        };
      }

      if (listDto.tag) {
        const tag = this._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      // 특정 user의 게시글이면서 삭제되지 않은 글
      query += ` WHERE Board.deleted_at IS NULL AND Board.user_id = ?`;
      params.push(writer.user_id);

      const isWriter = writer.user_id === listDto.userId ? true : false;

      // 작성자와 동일하지 않은 경우 공개 게시글만 보여주도록 제한
      if (!isWriter) query += ' AND Board.board_public = TRUE';

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
        query += ` AND (board_title LIKE '%${queryValue}%' OR REGEXP_REPLACE(board_content, '<[^>]+>', '') LIKE '%${queryValue}%')`;
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
        query += ` AND (Board.created_at ${listDto.isBefore ? '>' : '<'} ? 
          OR (Board.created_at = ? AND Board.board_order ${listDto.isBefore ? '>' : '<'} ?)) 
          ORDER BY Board.board_order ${listDto.isBefore ? 'ASC' : 'DESC'}, 
          Board.created_at ${listDto.isBefore ? 'ASC' : 'DESC'} LIMIT ?`;

        params.push(
          boardByCursor.created_at,
          boardByCursor.created_at,
          boardByCursor.board_order
        );
      } else {
        query += ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
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
      data = await this._reflectCashed(data);

      if (listDto.cursor && listDto.isBefore === true) {
        //커서가 있고, 이전 페이지를 조회하는 경우
        data = data.reverse();
      }

      data.isWriter = isWriter;
      // data 배열의 각 객체에 isWriter 속성을 추가
      // 카테고리 이름이 없을 경우 "기본 카테고리"로 설정
      data = data.map((boardData: BoardInDBDto) => {
        boardData.isWriter = isWriter; // isWriter는 해당 게시글을 작성한 사용자의 고유 식별자일 것
        if (!boardData.category_name) {
          boardData.category_name = '기본 카테고리';
        }
        return boardData;
      });

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

  static getUserListByLikeOrView = async (listDto: UserListDto) => {
    try {
      let query = ``;
      const params: (string | string[] | number)[] = [];

      const [writer] = await db.query(
        // 검색 대상인 유저를 찾음
        'SELECT user_id FROM User WHERE user_nickname = ? LIMIT 1;',
        decodeURIComponent(listDto.nickname)
      );

      if (!writer) {
        return {
          result: false,
          data: null,
          total: null,
          message: '검색 대상인 유저가 존재하지 않습니다'
        };
      }

      if (listDto.tag) {
        const tag = this._AddTagCondition(listDto.tag);
        query += tag.query;
        params.push(...tag.params);
      }

      // 특정 user의 게시글이면서 삭제되지 않은 글
      query += ` WHERE Board.deleted_at IS NULL AND Board.user_id = ?`;
      params.push(writer.user_id);

      const isWriter = writer.user_id === listDto.userId ? true : false;

      // 작성자와 동일하지 않은 경우 공개 게시글만 보여주도록 제한
      if (!isWriter) query += ' AND Board.board_public = TRUE';

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
        query += ` AND (board_title LIKE '%${queryValue}%' OR REGEXP_REPLACE(board_content, '<[^>]+>', '') LIKE '%${queryValue}%')`;
      }

      const [countResult] = await db.query(
        `  SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );

      let data = await db.query(
        `SELECT DISTINCT Board.*, User.user_nickname, Board_Category.category_name
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
          query,
        params
      );
      data = await this._reflectCashed(data);

      if (listDto.sort === 'like') {
        data.sort(
          (a: BoardInDBDto, b: BoardInDBDto) =>
            b.board_like - a.board_like ||
            b.created_at.getTime() - a.created_at.getTime() ||
            b.board_order - a.board_order
        );
      } else if (listDto.sort === 'view') {
        data.sort(
          (a: BoardInDBDto, b: BoardInDBDto) =>
            b.board_view - a.board_view ||
            b.created_at.getTime() - a.created_at.getTime() ||
            b.board_order - a.board_order
        );
      }

      const pageSize = listDto.pageSize || 10;
      if (listDto.cursor) {
        const cursorIndex = data.findIndex(
          (item: BoardInDBDto) => item.board_id === listDto.cursor
        );

        if (cursorIndex === -1) {
          return {
            result: false,
            data: data,
            total: {
              totalCount: [],
              totalPageCount: []
            },
            message: '유효하지 않은 커서'
          };
        }

        data = listDto.isBefore
          ? data.slice(Math.max(0, cursorIndex - pageSize), cursorIndex)
          : data.slice(cursorIndex + 1, cursorIndex + 1 + pageSize);
      } else {
        data = data.slice(0, pageSize);
      }

      data.isWriter = isWriter;

      // 카테고리 이름이 없을 경우 "기본 카테고리"로 설정
      data = data.map((boardData: BoardInDBDto) => {
        boardData.isWriter = isWriter; // isWriter는 해당 게시글을 작성한 사용자의 고유 식별자일 것
        if (!boardData.category_name) {
          boardData.category_name = '기본 카테고리';
        }
        return boardData;
      });

      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize); // 총 페이지 수
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
