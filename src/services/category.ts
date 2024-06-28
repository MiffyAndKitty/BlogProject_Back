import { db } from '../loaders/mariadb';
import { ensureError } from '../errors/ensureError';
import { CategoryDto } from '../interfaces/category';

export class categoryService {
  static getList = async (categoryDto: CategoryDto) => {
    try {
      const list =
        categoryDto.level === 0
          ? await db.query(
              `SELECT category_id, category_name FROM Board_Category0 WHERE user_id = ? AND deleted_at IS NULL`,
              [categoryDto.userId]
            )
          : await db.query(
              `SELECT category_id, category_name FROM Board_Category${categoryDto.level} WHERE topcategory_id = ? AND deleted_at IS NULL`,
              [categoryDto.topcategoryId]
            );

      return list.length >= 0
        ? {
            result: true,
            data: list,
            message: '게시글 카테고리 리스트 조회 성공'
          }
        : {
            result: false,
            data: null,
            message: '게시글 카테고리 리스트 조회 실패'
          };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, data: null, message: error.message };
    }
  };

  static create = async (categoryDto: CategoryDto) => {
    try {
      const created =
        categoryDto.level === 0 || categoryDto.level === undefined
          ? await db.query(
              `INSERT INTO Board_Category0 (user_id, category_name) VALUES (?, ?) `,
              [categoryDto.userId, categoryDto.categoryName]
            )
          : await db.query(
              `INSERT INTO Board_Category${categoryDto.level} (topcategory_id, category_name) VALUES (?, ?) `,
              [categoryDto.topcategoryId, categoryDto.categoryName]
            );
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
      const restored =
        categoryDto.level === 0 || categoryDto.level === undefined
          ? await db.query(
              `UPDATE Board_Category0 SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND category_name=?`,
              [categoryDto.userId, categoryDto.categoryName]
            )
          : await db.query(
              `UPDATE Board_Category${categoryDto.level} SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP  WHERE topcategory_id = ? AND category_name=?`,
              [categoryDto.topcategoryId, categoryDto.categoryName]
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

  static modify = async (categoryDto: CategoryDto) => {
    try {
      const updated = await db.query(
        `UPDATE Board_Category${categoryDto.level} SET category_name = ? WHERE category_id =?`,
        [categoryDto.categoryName, categoryDto.categoryId]
      );

      return updated.affectedRows === 1
        ? { result: true, message: '카테고리명 업데이트 성공' }
        : { result: false, message: '카테고리명 업데이트 실패' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };

  static delete = async (categoryDto: CategoryDto) => {
    try {
      const deleted = await db.query(
        `UPDATE Board_Category${categoryDto.level} SET deleted_at = CURRENT_TIMESTAMP WHERE category_id =? AND deleted_at IS NULL`,
        [categoryDto.categoryId]
      );

      if (deleted.affectedRows === 1) {
        return { result: true, message: '카테고리 삭제 성공' };
      } else {
        return { result: false, message: '카테고리 삭제 실패' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
