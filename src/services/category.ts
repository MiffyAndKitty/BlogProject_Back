import { db } from '../loaders/mariadb';
import { ensureError } from '../errors/ensureError';
import {
  CategoryIdDto,
  CategoryListDto,
  HierarchicalCategoryDto,
  NewCategoryDto,
  UpdateCategoryLevelDto,
  UpdateCategoryNameDto
} from '../interfaces/category';
import { v4 as uuidv4 } from 'uuid';
/*import { NotFoundError } from '../errors/notFoundError';*/
import { InternalServerError } from '../errors/internalServerError';
import { ConflictError } from '../errors/conflictError';
/*import { BadRequestError } from '../errors/badRequestError';*/

export class categoryService {
  static getAllList = async (categoryDto: CategoryListDto) => {
    const [user] = await db.query(
      `SELECT user_id FROM User WHERE user_nickname = ? AND deleted_at IS NULL LIMIT 1;`,
      [categoryDto.nickname]
    );

    if (!user) {
      return {
        result: false,
        message: '해당 닉네임을 가진 유저가 존재하지 않습니다.'
      };
      //  throw new NotFoundError('해당 닉네임을 가진 유저가 존재하지 않습니다.');
    }

    // 카테고리 ID가 없는 게시글의 개수 조회
    const [uncategorizedCountResult] = await db.query(
      `SELECT CAST(COUNT(board_id) AS CHAR) AS uncategorized_count
       FROM Board
       WHERE (category_id IS NULL OR category_id = '') AND user_id = ? AND deleted_at IS NULL;`,
      [user.user_id]
    );
    const uncategorizedCount = parseInt(
      uncategorizedCountResult.uncategorized_count
    );

    // 유저가 작성한 전체 게시글의 개수 조회
    const [totalPostCountResult] = await db.query(
      `SELECT CAST(COUNT(board_id) AS CHAR) AS total_post_count
       FROM Board
       WHERE user_id = ? AND deleted_at IS NULL;`,
      [user.user_id]
    );
    const totalPostCount = parseInt(totalPostCountResult.total_post_count);

    const categories = await db.query(
      `SELECT 
          C.topcategory_id, C.category_id, C.category_name, CAST(COUNT(B.board_id) AS CHAR) AS board_count
        FROM 
          Board_Category C
        LEFT JOIN
          Board B ON B.category_id = C.category_id AND B.user_id = ? AND B.deleted_at IS NULL
        WHERE 
          C.user_id = ? AND C.deleted_at IS NULL 
        GROUP BY 
          C.category_id, C.category_name, C.topcategory_id
        ORDER BY 
          C.created_at ASC;`,
      [user.user_id, user.user_id]
    );

    const parsedCategories = categories.map(
      (row: {
        category_id: string;
        category_name: string;
        category_topcategory: string | null;
        board_count: string;
      }) => ({
        ...row,
        category_topcategory: row.category_topcategory || 'root',
        board_count: parseInt(row.board_count, 10)
      })
    );

    // 상위 카테고리와 그 하위 카테고리들을 포함하여 트리 구조로 변환
    const hierarchicalCategory = await categoryService._getHierarchicalCategory(
      parsedCategories,
      categoryDto.topcategoryId
    );
    const owner = user.user_id === categoryDto.userId; // 카테고리 소유자 여부

    return {
      result: true,
      data: {
        totalPostCount, // 유저가 작성한 전체 게시글의 개수 추가
        uncategorizedCount, // 카테고리 ID가 없는 게시글의 개수 추가
        hierarchicalCategory
      },
      owner: owner,
      message: '사용자의 전체 게시글 카테고리 리스트 조회 성공'
    };
  };

  private static _getHierarchicalCategory = async (
    categories: HierarchicalCategoryDto[],
    topCategoryId?: string
  ) => {
    // 카테고리를 계층적으로 구성하기 위해 부모 카테고리를 기준으로 그룹화
    try {
      const categoryMap = categories.reduce(
        (
          map: { [key: string]: HierarchicalCategoryDto[] },
          category: HierarchicalCategoryDto
        ) => {
          const parentId = category.topcategory_id || 'root';
          if (!map[parentId]) {
            map[parentId] = [];
          }
          map[parentId].push(category);
          return map;
        },
        { root: [] }
      );

      // 재귀적으로 계층 구조를 생성하면서, 하위 카테고리의 게시글 수를 상위 카테고리에 더하는 함수
      const buildCategoryTree = (
        parentId: string
      ): HierarchicalCategoryDto[] => {
        const categories = categoryMap[parentId] || []; // 부모 ID에 대한 카테고리 배열
        return categories.map((category: HierarchicalCategoryDto) => {
          const subcategories = buildCategoryTree(category.category_id);

          // 하위 카테고리들의 게시글 수를 모두 더함
          const totalBoardCount = subcategories.reduce(
            (sum, subcategory) => sum + subcategory.board_count,
            category.board_count //현재 카테고리의 게시글 수 포함
          );

          return {
            category_id: category.category_id,
            category_name: category.category_name,
            board_count: totalBoardCount, // 상위 카테고리로 누적된 게시글 수
            ...(subcategories.length > 0 && { subcategories }) // 하위 카테고리가 있으면 포함
          };
        });
      };

      // 상위 카테고리가 지정되었을 때, 그 카테고리와 그 하위 카테고리들을 포함하여 반환
      if (topCategoryId) {
        return buildCategoryTree(topCategoryId);
      }

      return buildCategoryTree('root');
    } catch (err) {
      throw ensureError(err, '카테고리를 계층적으로 구성하는 중 에러 발생');
    }
  };

  static create = async (categoryDto: NewCategoryDto) => {
    try {
      if (categoryDto.topcategoryId) {
        const [topcategory] = await db.query(
          `SELECT 1 FROM Board_Category WHERE category_id = ? AND deleted_at IS NULL;`,
          [categoryDto.topcategoryId]
        );
        if (!topcategory)
          throw new InternalServerError(
            '상위 카테고리로 지정한 카테고리가 존재하지 않습니다'
          );
        /*
          throw new BadRequestError(
            '상위 카테고리로 지정한 카테고리가 존재하지 않습니다'
          );
          */
      }

      const categoryId = uuidv4().replace(/-/g, '');

      const existQuery = `SELECT EXISTS (
                      SELECT 1 
                      FROM Board_Category
                      WHERE category_name = ?
                        AND user_id = ? 
                        AND topcategory_id = ? 
                        AND deleted_at IS NULL
                    ) AS isExists;`;

      const existParams = [
        categoryDto.categoryName,
        categoryDto.userId,
        categoryDto.topcategoryId ?? null
      ];

      const [{ isExists: isExists }] = await db.query(existQuery, existParams);

      if (isExists) {
        throw new ConflictError(
          '중복된 이름의 카테고리 입니다. 다른 이름으로 변경해주세요.'
        );
      }

      const query = `INSERT INTO Board_Category (user_id, category_id, category_name, topcategory_id ) VALUES (?,?,?,?);`;
      const params = [
        categoryDto.userId,
        categoryId,
        categoryDto.categoryName,
        categoryDto.topcategoryId ?? null
      ];

      const created = await db.query(query, params);

      if (created.affectedRow === 0) {
        throw new InternalServerError('카테고리 저장 실패');
      }

      return { result: true, message: '카테고리 저장 성공' };
    } catch (err) {
      throw ensureError(err, '카테고리 생성 중 에러 발생');
    }
  };

  static modifyName = async (categoryDto: UpdateCategoryNameDto) => {
    const updated = await db.query(
      `UPDATE Board_Category SET category_name = ? WHERE category_id =? AND user_id = ? AND deleted_at IS NULL `,
      [categoryDto.categoryName, categoryDto.categoryId, categoryDto.userId]
    );
    if (updated.affectedRows === 0) {
      throw new InternalServerError(
        '카테고리명 업데이트 실패 ( 예시 : 카테고리가 삭제된 경우 )'
      );
    }
    return { result: true, message: '카테고리명 업데이트 성공' };
  };

  static modifyLevel = async (categoryDto: UpdateCategoryLevelDto) => {
    const { userId, categoryId, newTopCategoryId } = categoryDto;

    const [currentCategory] = await db.query(
      `SELECT category_name FROM Board_Category 
       WHERE categoryId = ?`,
      [categoryId]
    );

    if (!currentCategory) {
      throw new InternalServerError('수정 대상 카테고리를 찾을 수 없습니다.');
    }

    // 중복된 카테고리 이름이 있는지 확인
    const [duplicatedName] = await db.query(
      `SELECT 1 FROM Board_Category 
          WHERE  user_id = ? 
            AND category_name = ?
            AND topcategory_id = ?
            AND deleted_at IS NULL`,
      [userId, currentCategory.name, newTopCategoryId ?? null]
    );

    if (duplicatedName) {
      return {
        result: false,
        message: '같은 위치에 동일한 카테고리 이름이 존재합니다.'
      };
    }

    const { affectedRows: modifiedCount } = await db.query(
      `UPDATE Board_Category 
         SET topcategory_id = ? 
         WHERE category_id = ? AND user_id = ?`,
      [newTopCategoryId ?? null, categoryId, userId]
    );

    if (modifiedCount === 0) {
      throw new InternalServerError('카테고리 레벨 업데이트 실패');
    }

    return {
      result: true,
      message: newTopCategoryId
        ? '카테고리를 하위 카테고리로 업데이트 성공'
        : '카테고리를 최상위 카테고리로 업데이트 성공'
    };
  };

  static delete = async (categoryDto: CategoryIdDto) => {
    // 삭제하려는 카테고리를 상위 카테고리로 가지는지 확인
    const [subcategories] = await db.query(
      `SELECT COUNT(*) AS subcategoryCount FROM Board_Category WHERE topcategory_id = ? AND user_id= ? AND deleted_at IS NULL`,
      [categoryDto.categoryId, categoryDto.userId]
    );

    if (subcategories.subcategoryCount > 0) {
      throw new InternalServerError(
        '삭제할 수 없는 카테고리: 하위 카테고리가 존재합니다.'
      );
      /*
      throw new BadRequestError(
        '삭제할 수 없는 카테고리: 하위 카테고리가 존재합니다.'
      );
      */
    }

    const { affectedRows: deletedCount } = await db.query(
      `UPDATE Board_Category AS C
        LEFT JOIN Board AS B ON B.category_id = C.category_id 
        SET B.deleted_at = CURRENT_TIMESTAMP, C.deleted_at = CURRENT_TIMESTAMP, C.topcategory_id = NULL
        WHERE C.category_id = ? 
          AND C.deleted_at IS NULL 
          AND B.deleted_at IS NULL;`,
      [categoryDto.categoryId]
    );

    if (deletedCount === 0) {
      throw new InternalServerError('카테고리 삭제 실패');
    }

    return {
      result: true,
      message: '카테고리 및 카테고리에 속한 게시글 삭제 성공'
    };
  };
}
