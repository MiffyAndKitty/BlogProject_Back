import { db } from '../../loaders/mariadb';
import { redis } from '../../loaders/redis';
import { ensureError } from '../../errors/ensureError';
import {
  ListDto,
  UserListDto,
  SortOptions,
  ViewOrLikeSortOptions
} from '../../interfaces/board/listDto';
import { BoardInDBDto } from '../../interfaces/board/boardInDB';
import { ListResponse, UserListResponse } from '../../interfaces/response';
import { parseFieldToNumber } from '../../utils/parseFieldToNumber';
import { CacheKeys } from '../../constants/cacheKeys';
import { BOARD_PAGESIZE_LIMIT } from '../../constants/pageSizeLimit';

export class BoardListService {
  static getList = async (listDto: ListDto): Promise<ListResponse> => {
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

      const pageSize = listDto.pageSize || BOARD_PAGESIZE_LIMIT;

      const sortOptions: SortOptions = {
        pageSize: pageSize,
        cursor: listDto.cursor,
        isBefore: listDto.isBefore
      };

      const sortedList =
        listDto.sort === 'view' || listDto.sort === 'like'
          ? await this._sortByViewOrLike(query, params, {
              ...sortOptions,
              sort: listDto.sort
            } as ViewOrLikeSortOptions)
          : await this._sortByASC(query, params, sortOptions);

      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize);
      console.log(query, params);
      return sortedList.length >= 0
        ? {
            result: true,
            data: sortedList,
            total: {
              totalCount: totalCount, // 총 글의 개수
              totalPageCount: totalPageCount // 총 페이지 수
            },
            message: '게시글 리스트 데이터 조회 성공'
          }
        : {
            result: false,
            data: null,
            total: null,
            message: '게시글 리스트 데이터 조회 실패'
          };
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

  static getUserList = async (
    listDto: UserListDto
  ): Promise<UserListResponse> => {
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

      const pageSize = listDto.pageSize || BOARD_PAGESIZE_LIMIT;

      const sortOptions: SortOptions = {
        pageSize: pageSize,
        cursor: listDto.cursor,
        isBefore: listDto.isBefore
      };

      const sortedList =
        listDto.sort === 'view' || listDto.sort === 'like'
          ? await this._sortByViewOrLike(query, params, {
              ...sortOptions,
              sort: listDto.sort
            } as ViewOrLikeSortOptions)
          : await this._sortByASC(query, params, sortOptions);

      const modifiedList = sortedList.map((boardData: BoardInDBDto) => {
        boardData.isWriter = isWriter; // data 배열의 각 객체에 isWriter 속성을 추가
        if (!boardData.category_name) boardData.category_name = '기본 카테고리'; // 카테고리 이름이 없을 경우 "기본 카테고리"로 설정
        return boardData;
      });

      const totalCount = Number(countResult.totalCount.toString());
      const totalPageCount = Math.ceil(totalCount / pageSize);

      return modifiedList.length >= 0
        ? {
            result: true,
            data: modifiedList,
            isWriter: isWriter,
            total: {
              totalCount: totalCount,
              totalPageCount: totalPageCount
            },
            message: '특정 사용자의 게시글 리스트 데이터 조회 성공'
          }
        : {
            result: false,
            data: null,
            isWriter: isWriter,
            total: null,
            message: '특정 사용자의 게시글 리스트 데이터 조회 실패'
          };
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
  ): { query: string; params: (string | string[] | number)[] } {
    const queryParts: string[] = [];
    const params: (string | string[] | number)[] = [];

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

  private static _AddTagCondition(boardTags: string): {
    query: string;
    params: (string[] | number)[];
  } {
    const tags = boardTags.split(',');

    const query = ` INNER JOIN Board_Tag ON Board.board_id = Board_Tag.board_id
                AND Board.board_id IN (
                SELECT Board_Tag.board_id
                FROM Board_Tag
                WHERE Board_Tag.tag_name IN (?)
                GROUP BY Board_Tag.board_id
                HAVING COUNT(DISTINCT Board_Tag.tag_name) = ?
            )`;
    const params = [tags, tags.length];
    return { query, params };
  }

  private static async _reflectCashed(data: BoardInDBDto[]) {
    const viewKeys = data.map(
      (board: { board_id: string }) => CacheKeys.BOARD_VIEW + board.board_id
    );
    const likeKeys = data.map(
      (board: { board_id: string }) => CacheKeys.BOARD_LIKE + board.board_id
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
    params: (string | number | string[])[],
    options: ViewOrLikeSortOptions
  ): Promise<BoardInDBDto[]> {
    // 1. 전체 게시글 반환
    let data = await db.query(
      `SELECT DISTINCT Board.*, User.user_nickname, User.user_email, Board_Category.category_name, 
      (SELECT COUNT(*) FROM Comment WHERE Comment.board_id = Board.board_id AND Comment.deleted_at IS NULL) as board_comment 
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
        query,
      params
    );

    data = parseFieldToNumber(data, 'board_comment');

    // 2. 캐시된 좋아요/ 조회수 반영
    data = await this._reflectCashed(data);

    // 3. 좋아요/조회수순으로 정렬
    switch (options.sort) {
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

    // 4-(1). 커서가 없는 경우, 처음부터 페이지 사이즈만큼 자르기
    if (!options.cursor) return data.slice(0, options.pageSize);

    // 4-(2). 커서가 있다면 커서 앞/뒤의 값인지(isBefore) 확인하여 배열의 크기만큼의 데이터를 반환
    const cursorIndex = data.findIndex(
      (board: BoardInDBDto) => board.board_id === options.cursor
    );

    if (cursorIndex === -1) throw new Error('유효하지 않은 커서');

    return options.isBefore
      ? data.slice(Math.max(0, cursorIndex - options.pageSize), cursorIndex) // 커서 이전의 데이터만 잘라서 반환
      : data.slice(cursorIndex + 1, cursorIndex + 1 + options.pageSize);
  }

  private static async _sortByASC(
    query: string,
    params: (string | number | string[])[],
    options: SortOptions
  ): Promise<BoardInDBDto[]> {
    if (!options.cursor) {
      // 커서가 없는 경우 : 최신순으로 정렬
      query += ` ORDER BY Board.board_order DESC, Board.created_at DESC LIMIT ?`;
      params.push(options.pageSize);
    } else {
      const [boardByCursor] = await db.query(
        `SELECT created_at, board_order, board_like, board_view FROM Board WHERE board_id = ?`,
        [options.cursor]
      );

      if (!boardByCursor) throw new Error('유효하지 않은 커서');

      query += ` AND (Board.created_at ${options.isBefore ? '>' : '<'} ? 
          OR (Board.created_at = ? AND Board.board_order ${options.isBefore ? '>' : '<'} ?)) 
          ORDER BY Board.board_order ${options.isBefore ? 'ASC' : 'DESC'}, 
          Board.created_at ${options.isBefore ? 'ASC' : 'DESC'} LIMIT ?`;
      params.push(
        boardByCursor.created_at,
        boardByCursor.created_at,
        boardByCursor.board_order,
        options.pageSize
      );
    }

    let data = await db.query(
      `SELECT DISTINCT Board.*, User.user_nickname, User.user_email, Board_Category.category_name, 
      (SELECT COUNT(*) FROM Comment WHERE Comment.board_id = Board.board_id AND Comment.deleted_at IS NULL) as board_comment 
        FROM Board 
        LEFT JOIN User ON Board.user_id = User.user_id
        LEFT JOIN Board_Category ON Board.category_id = Board_Category.category_id` +
        query,
      params
    );

    data = parseFieldToNumber(data, 'board_comment');

    //커서가 있고, 이전 페이지를 조회하는 경우
    if (options.cursor && options.isBefore === true) data = data.reverse();

    return await this._reflectCashed(data);
  }
}
