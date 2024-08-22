import { db } from '../../loaders/mariadb';
import { redis } from '../../loaders/redis';
import { ensureError } from '../../errors/ensureError';
import { ListDto, UserListDto } from '../../interfaces/board/listDto';
import { BoardInDBDto } from '../../interfaces/board/boardInDB';

export class BoardListService {
  static getList = async (listDto: ListDto) => {
    try {
      const { query, params } = this._buildQueryConditions(
        listDto.query,
        listDto.tag
      );

      const [countResult] = await db.query(
        `SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );

      const pageSize = listDto.pageSize || 10;
      const sortedList =
        listDto.sort === 'view' || listDto.sort === 'like'
          ? await this._sortByViewOrLike(query, params, {
              sort: listDto.sort,
              pageSize: pageSize,
              cursor: listDto.cursor,
              isBefore: listDto.isBefore
            })
          : await this._sortByASC(query, params, {
              pageSize: pageSize,
              cursor: listDto.cursor,
              isBefore: listDto.isBefore
            });

      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize);

      if (sortedList.length >= 0) {
        return {
          result: true,
          data: sortedList,
          total: {
            totalCount: totalCount, // 총 글의 개수
            totalPageCount: totalPageCount // 총 페이지 수
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

      let { query, params } = this._buildQueryConditions(
        listDto.query,
        listDto.tag
      );

      query += ` AND Board.user_id = ?`;
      params.push(writer.user_id);

      const isWriter = writer.user_id === listDto.userId;

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

      const [countResult] = await db.query(
        `SELECT COUNT(*) AS totalCount FROM (SELECT DISTINCT Board.board_id FROM Board ` +
          query +
          ` ) AS distinctBoards`,
        params
      );

      const pageSize = listDto.pageSize || 10;
      const sortedList =
        listDto.sort === 'view' || listDto.sort === 'like'
          ? await this._sortByViewOrLike(query, params, {
              sort: listDto.sort,
              pageSize: pageSize,
              cursor: listDto.cursor,
              isBefore: listDto.isBefore
            })
          : await this._sortByASC(query, params, {
              pageSize: pageSize,
              cursor: listDto.cursor,
              isBefore: listDto.isBefore
            });

      const modifiedList = sortedList.map((boardData: BoardInDBDto) => {
        boardData.isWriter = isWriter; // data 배열의 각 객체에 isWriter 속성을 추가
        if (!boardData.category_name) boardData.category_name = '기본 카테고리'; // 카테고리 이름이 없을 경우 "기본 카테고리"로 설정
        return boardData;
      });

      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize);

      if (modifiedList.length >= 0) {
        return {
          result: true,
          data: modifiedList,
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

  private static _buildQueryConditions(
    queryValue?: string,
    tag?: string
  ): { query: string; params: any[] } {
    let queryParts: string[] = [];
    const params: any[] = [];

    queryParts.push(
      'WHERE Board.deleted_at IS NULL AND Board.board_public = TRUE'
    );
    if (queryValue) {
      const decodedQuery = decodeURIComponent(queryValue);
      queryParts.push(
        `AND (board_title LIKE ? OR REGEXP_REPLACE(board_content, '<[^>]+>', '') LIKE ?)`
      );
      params.push(`%${decodedQuery}%`, `%${decodedQuery}%`);
    }

    if (tag) {
      const tagCondition = this._AddTagCondition(tag);
      queryParts.push(tagCondition.query);
      params.push(...tagCondition.params);
    }

    return { query: ' ' + queryParts.join(' '), params };
  }

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

    const [viewCounts, likeCounts] = await Promise.all([
      Promise.all(viewKeys.map((key) => redis.scard(key))),
      Promise.all(likeKeys.map((key) => redis.scard(key)))
    ]);

    data.forEach((board, index) => {
      board.board_view += Number(viewCounts[index]) || 0;
      board.board_like += Number(likeCounts[index]) || 0;
    });

    return data;
  }

  private static async _sortByViewOrLike(
    query: string,
    params: any[],
    listDto: {
      sort: 'view' | 'like';
      pageSize: number;
      cursor?: string;
      isBefore?: boolean;
    }
  ) {
    // 1. 전체 게시글 반환
    let data = await db.query(
      `SELECT DISTINCT Board.*, User.user_nickname, Board_Category.category_name 
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
        query,
      params
    );
    // 2. 캐시된 좋아요/ 조회수 반영
    data = await this._reflectCashed(data);

    // 3. 좋아요/조회수순으로 정렬
    switch (listDto.sort) {
      case 'like':
        data.sort(
          (a: BoardInDBDto, b: BoardInDBDto) =>
            b.board_like - a.board_like ||
            b.created_at.getTime() - a.created_at.getTime() ||
            b.board_order - a.board_order
        );
        break;
      case 'view':
        data.sort(
          (a: BoardInDBDto, b: BoardInDBDto) =>
            b.board_view - a.board_view ||
            b.created_at.getTime() - a.created_at.getTime() ||
            b.board_order - a.board_order
        );
        break;
    }

    // 4. 커서, 커서 앞/뒤의 값인지(isBefore), 배열의 크기만큼 반환
    if (!listDto.cursor) {
      // 커서가 없는 경우, 처음부터 페이지 사이즈만큼 자르기
      return data.slice(0, listDto.pageSize);
    }

    const cursorIndex = data.findIndex(
      (board: BoardInDBDto) => board.board_id === listDto.cursor
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

    return listDto.isBefore
      ? data.slice(Math.max(0, cursorIndex - listDto.pageSize), cursorIndex) // 커서 이전의 데이터만 잘라서 반환
      : data.slice(cursorIndex + 1, cursorIndex + 1 + listDto.pageSize);
  }

  private static async _sortByASC(
    query: string,
    params: any[],
    listDto: { pageSize: number; cursor?: string; isBefore?: boolean }
  ) {
    if (!listDto.cursor) {
      // 커서가 없는 경우 : 최신순으로 정렬
      query += ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
      params.push(listDto.pageSize);
    } else {
      const [boardByCursor] = await db.query(
        `SELECT created_at, board_order, board_like, board_view FROM Board WHERE board_id = ?`,
        [listDto.cursor]
      );

      if (!boardByCursor) {
        throw new Error('커서에 해당하는 게시글 id가 유효하지 않습니다.');
      }

      query += ` AND (Board.created_at ${listDto.isBefore ? '>' : '<'} ? 
          OR (Board.created_at = ? AND Board.board_order ${listDto.isBefore ? '>' : '<'} ?)) 
          ORDER BY Board.board_order ${listDto.isBefore ? 'ASC' : 'DESC'}, 
          Board.created_at ${listDto.isBefore ? 'ASC' : 'DESC'} LIMIT ?`;
      params.push(
        boardByCursor.created_at,
        boardByCursor.created_at,
        boardByCursor.board_order,
        listDto.pageSize
      );
    }

    let data = await db.query(
      `SELECT DISTINCT Board.*, User.user_nickname, Board_Category.category_name 
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
        query,
      params
    );

    //커서가 있고, 이전 페이지를 조회하는 경우
    if (listDto.cursor && listDto.isBefore === true) data = data.reverse();

    return await this._reflectCashed(data);
  }
}
