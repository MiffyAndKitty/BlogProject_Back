import { db } from '../loaders/mariadb';
import { ensureError } from '../errors/ensureError';
import {
  CategoryDto,
  CategoryListDto,
  HierarchicalCategoryDto
} from '../interfaces/category';
import { v4 as uuidv4 } from 'uuid';

export class categoryService {
  static getAllList = async (categoryDto: CategoryListDto) => {
    try {
      const decodedNickname = decodeURIComponent(categoryDto.nickname);

      const [user] = await db.query(
        `SELECT user_id FROM User WHERE user_nickname= ? AND deleted_at IS NULL LIMIT 1;`,
        [decodedNickname]
      );

      if (!user) {
        throw new Error(
          '검색한 닉네임의 카테고리가 존재하지 않아 전체 카테고리 리스트를 조회할 수 없습니다.'
        );
      }

      const categories = await db.query(
        `SELECT * FROM Board_Category WHERE user_id = ? AND deleted_at IS NULL ORDER BY created_at ASC`,
        [user.user_id]
      );

      // 상위 카테고리와 그 하위 카테고리들을 포함하여 조회
      const hierarchicalCategory =
        await categoryService._getHierarchicalCategory(
          categories,
          categoryDto.topcategoryId
        );
      const owner = user.user_id === categoryDto.userId; // 카테고리 소유자 여부

      return {
        result: true,
        data: hierarchicalCategory,
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
      const [category] = await db.query(
        // 삭제 대상 카테고리 존재 여부
        `SELECT * FROM Board_Category WHERE category_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [categoryDto.categoryId, categoryDto.userId]
      );

      if (category.category_level === 2) {
        const deleted = await db.query(
          `UPDATE Board_Category SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ? AND user_id= ? AND deleted_at IS NULL`,
          [categoryDto.categoryId, categoryDto.userId]
        );
        return deleted.affectedRows === 1
          ? { result: true, message: '레벨 2의 카테고리 삭제 성공' }
          : { result: false, message: '레벨 2의 카테고리 삭제 실패' };
      }

      if (category.category_level === 1) {
        const deleted = await db.query(
          `UPDATE Board_Category SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ? AND user_id= ? AND deleted_at IS NULL`,
          [categoryDto.categoryId, categoryDto.userId]
        );

        if (!(deleted.affectedRows === 1)) {
          return { result: false, message: '레벨 1의 카테고리 삭제 실패' };
        }

        // category.category_id를 상위 카테고리로 가지는 카테고리들의 상위 카테고리 값을 category.topcategory_id로 변경 및 category_level -1
        const updateSubCategories = await db.query(
          `UPDATE Board_Category SET topcategory_id = ?, category_level = category_level - 1 WHERE topcategory_id = ? AND user_id = ? AND category_level = ? AND deleted_at IS NULL;`,
          [category.topcategory_id, category.category_id, categoryDto.userId, 2]
        );

        return updateSubCategories.affectedRows > 0
          ? {
              result: true,
              message: '레벨 1의 카테고리 삭제 성공 및 하위 카테고리 삭제 성공'
            }
          : {
              result: true,
              message:
                '레벨 1의 카테고리 삭제 성공 및 삭제될 하위 카테고리 존재하지 않음'
            };
      }
      // 레벨 0의 경우
      // 0. soft delete
      const deleted = await db.query(
        `UPDATE Board_Category SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ? AND user_id= ? AND deleted_at IS NULL`,
        [categoryDto.categoryId, categoryDto.userId]
      );
      if (deleted.affectedRows === 0) {
        return { result: false, message: '카테고리 삭제 실패' };
      }

      // 1. 삭제 대상 id를 상위 카테고리로 가지는 카테고리id들을 불러와서 subCategories에 저장
      const subCategories = await db.query(
        `SELECT category_id FROM Board_Category WHERE topcategory_id = ? AND user_id = ? AND deleted_at IS NULL`,
        [categoryDto.categoryId, categoryDto.userId]
      );
      const subCategoriesIds = subCategories.map(
        (category: { category_id: string }) => category.category_id
      );

      if (subCategoriesIds.length === 0) {
        return {
          result: true,
          message: '카테고리 삭제 성공, 수정할 하위 카테고리가 존재하지 않음'
        };
      }

      // 2. subCategories의 카테고리 id를 가지는 카테고리들의 topcategory_id의 값을 NULL로 변경, level을 -1
      const updateSubCategories = await db.query(
        `UPDATE Board_Category SET topcategory_id = NULL, category_level = category_level - 1 WHERE category_id IN (?) AND user_id = ?`,
        [subCategoriesIds, categoryDto.userId]
      );

      if (updateSubCategories === 0) {
        return {
          result: false,
          message: '카테고리 삭제 성공, 하위 카테고리 수정 실패'
        };
      }
      // 3. subCategories에 저장된 카테고리 id를 상위 카테고리로 가지는 id가 있다면 level을 1 낮춤
      const SubOfSubcategories = await db.query(
        `SELECT category_id FROM Board_Category WHERE topcategory_id IN (?) AND user_id = ?`,
        [subCategoriesIds, categoryDto.userId]
      );

      if (SubOfSubcategories.length === 0) {
        return {
          result: true,
          message: '카테고리 삭제 성공, 하위 카테고리 수정 성공'
        };
      }

      const updateSubOfSub = SubOfSubcategories.map(
        (category: { category_id: string }) => category.category_id
      );

      const updateNestedSubCategories = await db.query(
        `UPDATE Board_Category SET category_level = category_level - 1 WHERE category_id IN (?) AND user_id = ?`,
        [updateSubOfSub, categoryDto.userId]
      );

      return updateSubOfSub.length === 0 &&
        updateNestedSubCategories.affectedRows === 0
        ? {
            result: false,
            message: '카테고리 삭제 성공, 하위 카테고리 수정 실패'
          }
        : {
            result: true,
            message: '카테고리 삭제 성공, 하위 카테고리 수정 성공'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
