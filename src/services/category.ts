import { db } from '../loaders/mariadb';
import { ensureError } from '../errors/ensureError';
import {
  CategoryDto,
  CategoryListDto,
  CategoryOwnerDto,
  HierarchicalCategoryDto
} from '../interfaces/category';
import { v4 as uuidv4 } from 'uuid';

export class categoryService {
  static getAllList = async (categoryDto: CategoryListDto) => {
    try {
      const [user] = await db.query(
        `SELECT user_id FROM User WHERE user_nickname = ? AND deleted_at IS NULL LIMIT 1;`,
        [categoryDto.nickname]
      );

      if (!user) {
        throw new Error(
          '검색한 닉네임의 카테고리가 존재하지 않아 전체 카테고리 리스트를 조회할 수 없습니다.'
        );
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
          C.category_id, C.category_name 
        ORDER BY 
          C.created_at ASC;`,
        [user.user_id, user.user_id]
      );

      const parsedCategories = categories.map(
        (row: {
          category_id: string;
          category_name: string;
          board_count: string;
        }) => ({
          ...row,
          board_count: parseInt(row.board_count, 10)
        })
      );

      // 상위 카테고리와 그 하위 카테고리들을 포함하여 조회
      const hierarchicalCategory =
        await categoryService._getHierarchicalCategory(
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
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return {
        result: false,
        data: null,
        owner: false,
        message: error.message
      };
    }
  };

  private static _getHierarchicalCategory = async (
    categories: HierarchicalCategoryDto[],
    topCategoryId?: string
  ) => {
    // 카테고리를 계층적으로 구성하기 위해 부모 카테고리를 기준으로 그룹화
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

    // 재귀적으로 계층 구조를 생성하는 함수
    const buildCategoryTree = (parentId: string): HierarchicalCategoryDto[] => {
      const categories = categoryMap[parentId] || []; // 부모 ID에 대한 카테고리 배열
      return categories.map((category: HierarchicalCategoryDto) => {
        const subcategories = buildCategoryTree(category.category_id);
        return {
          category_id: category.category_id,
          category_name: category.category_name,
          board_count: category.board_count,
          ...(subcategories.length > 0 && { subcategories }) // subcategories가 비어있지 않으면 포함
        };
      });
    };

    // 상위 카테고리가 지정되었을 때, 그 카테고리와 그 하위 카테고리들을 포함하여 반환
    if (topCategoryId) {
      return buildCategoryTree(topCategoryId);
    }

    return buildCategoryTree('root');
  };

  static countPostsInCategory = async (categoryDto: CategoryOwnerDto) => {
    try {
      const countList = await db.query(
        `
          SELECT 
              C.category_id,
              C.category_name, 
              CAST(COUNT(B.board_id) AS CHAR) AS board_count
          FROM 
              Board_Category C
          JOIN 
              User U ON C.user_id = U.user_id
          LEFT JOIN 
              Board B ON B.category_id = C.category_id AND B.user_id = U.user_id AND B.deleted_at IS NULL
          WHERE 
              U.user_nickname = ? AND C.deleted_at IS NULL 
          GROUP BY 
              C.category_name
          ORDER BY
              C.created_at;
          `,
        [categoryDto.nickname]
      );

      if (countList.length === 0) {
        return {
          result: false,
          data: [],
          message: '각 카테고리 별 게시글 개수 데이터가 존재하지 않음'
        };
      }

      const parsedList = countList.map(
        (row: { category_name: string; board_count: string }) => ({
          ...row,
          board_count: parseInt(row.board_count, 10)
        })
      );

      return {
        result: true,
        data: parsedList,
        message: '각 카테고리 별 게시글 개수를 반환 성공'
      };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static create = async (categoryDto: CategoryDto) => {
    try {
      const categoryId = uuidv4().replace(/-/g, '');
      let level = 0;

      let query = `INSERT INTO Board_Category (user_id, category_id, category_name, category_level) VALUES (?,?,?,?) `;
      const params: (string | number)[] = [
        categoryDto.userId as string,
        categoryId,
        categoryDto.categoryName!
      ];

      if (categoryDto.topcategoryId) {
        // 상위 카테고리가 주어진 경우
        const [topCategory] = await db.query(
          // 상위 카테고리
          `SELECT * FROM Board_Category WHERE user_id = ? AND category_id = ? AND deleted_at IS NULL LIMIT 1;`,
          [categoryDto.userId, categoryDto.topcategoryId]
        );
        level = topCategory.category_level + 1;
        query = `INSERT INTO Board_Category (user_id, category_id, category_name, category_level, topcategory_id) VALUES (?,?,?,?,?) `;
        params.push(level, categoryDto.topcategoryId);
      } else {
        params.push(level);
      }

      const created = await db.query(query, params);

      if (created.affectedRows === 1) {
        return { result: true, message: '카테고리 저장 성공' };
      } else {
        return { result: false, message: '카테고리 저장 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      const isDuplicated = Boolean(
        error.message.match(/Duplicate entry '(.+)' for key/)
      );
      if (isDuplicated) {
        return await categoryService._restore(categoryDto);
      }
      return { result: false, message: error.message };
    }
  };

  private static _restore = async (categoryDto: CategoryDto) => {
    try {
      const topCategory = categoryDto.topcategoryId || null;

      const query = `SELECT * FROM Board_Category WHERE user_id = ? AND category_name = ? AND deleted_at IS NOT NULL AND topcategory_id = ? `; // 삭제된 카테고리
      const params = [
        categoryDto.userId,
        categoryDto.categoryName,
        topCategory
      ];

      const [origin] = await db.query(query, params);

      if (!origin) {
        throw new Error(
          '카테고리 복원 에러 발생 ( 예시 : 삭제된 카테고리가 존재하지 않는 경우, 동일 레벨&이름의 카테고리가 이미 존재 )'
        );
      }
      const restored = await db.query(
        `UPDATE Board_Category SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE category_id = ? `,
        [origin.category_id]
      );

      if (restored.affectedRows === 1) {
        return { result: true, message: '카테고리 복원 성공' };
      } else {
        return { result: false, message: '카테고리 복원 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error);
      return {
        result: false,
        message: '카테고리 복원 에러 발생 : ' + error.message
      };
    }
  };

  static modifyName = async (categoryDto: CategoryDto) => {
    try {
      const updated = await db.query(
        `UPDATE Board_Category SET category_name = ? WHERE category_id =? AND user_id = ? AND deleted_at IS NULL `,
        [categoryDto.categoryName, categoryDto.categoryId, categoryDto.userId]
      );
      return updated.affectedRows === 1
        ? { result: true, message: '카테고리명 업데이트 성공' }
        : {
            result: false,
            message:
              '카테고리명 업데이트 실패 ( 예시 : 카테고리가 삭제된 경우 )'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static modifyLevel = async (categoryDto: CategoryDto) => {
    try {
      let level = 0;

      if (categoryDto.topcategoryId) {
        const [topCategory] = await db.query(
          // 상위 카테고리
          `SELECT category_level FROM Board_Category WHERE user_id = ? AND category_id = ? AND deleted_at IS NULL LIMIT 1;`,
          [categoryDto.userId, categoryDto.topcategoryId]
        );
        console.log('topCategory : ', topCategory);
        level = topCategory.category_level + 1;
      }

      const updated = await db.query(
        `UPDATE Board_Category SET category_level = ?, topcategory_id = ? WHERE category_id =? AND user_id = ? AND deleted_at IS NULL `,
        [
          level,
          categoryDto.topcategoryId,
          categoryDto.categoryId,
          categoryDto.userId
        ]
      );

      return updated.affectedRows === 1
        ? { result: true, message: '카테고리 레벨 업데이트 성공' }
        : {
            result: false,
            message: '카테고리 레벨 업데이트 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static delete = async (categoryDto: CategoryDto) => {
    try {
      // 삭제하려는 카테고리를 상위 카테고리로 가지는지 확인
      const [subcategories] = await db.query(
        `SELECT COUNT(*) AS subcategoryCount FROM Board_Category WHERE topcategory_id = ? AND user_id= ? AND deleted_at IS NULL`,
        [categoryDto.categoryId, categoryDto.userId]
      );

      if (subcategories.subcategoryCount > 0) {
        return {
          result: false,
          message: '삭제할 수 없는 카테고리: 하위 카테고리가 존재합니다.'
        };
      }

      const { affectedRows: deletedCount } = await db.query(
        `UPDATE Board_Category SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ? AND user_id= ? AND deleted_at IS NULL`,
        [categoryDto.categoryId, categoryDto.userId]
      );

      return deletedCount === 1
        ? { result: true, message: '카테고리 삭제 성공' }
        : { result: false, message: '카테고리 삭제 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
