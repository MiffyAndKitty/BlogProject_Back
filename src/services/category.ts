import { db } from '../loaders/mariadb';
import { ensureError } from '../errors/ensureError';
import {
  CategoryDto,
  CategoryListDto,
  CategorySaveDto
} from '../interfaces/category';
import { v4 as uuidv4 } from 'uuid';

export class categoryService {
  static getList = async (categoryDto: CategoryListDto) => {
    try {
      const decodedNickname = decodeURIComponent(categoryDto.nickname);

      const [user] = await db.query(
        // 카테고리 소유자
        `SELECT user_id FROM User WHERE user_nickname= ? AND deleted_at IS NULL LIMIT 1;`,
        [decodedNickname]
      );

      if (!user) {
        throw new Error(
          '해당 닉네임을 소유한 유저가 생성한 카테고리가 아니거나 삭제된 카테고리입니다.'
        );
      }
      const topCategoryLevel: string | undefined =
        categoryDto.topcategoryId?.charAt(0);
      const level =
        typeof topCategoryLevel === 'string' ? parseInt(topCategoryLevel) : NaN;

      if (!isNaN(level) && level !== 0 && level !== 1) {
        throw new Error(
          '상위 카테고리 레벨이 존재한다면 0,1 중 하나여야 합니다.'
        );
      }
      const list =
        !isNaN(level) && (level === 0 || level === 1)
          ? await db.query(
              `SELECT category_id, category_name FROM Board_Category${level + 1} WHERE user_id = ? AND topcategory_id = ? AND deleted_at IS NULL`,
              [user.user_id, categoryDto.topcategoryId]
            )
          : await db.query(
              `SELECT category_id, category_name FROM Board_Category0 WHERE user_id = ? AND deleted_at IS NULL`,
              [user.user_id]
            );
      const owner = user.user_id === categoryDto.userId ? true : false;

      return list.length >= 0
        ? {
            result: true,
            data: list,
            owner: owner,
            message: '게시글 카테고리 리스트 조회 성공'
          }
        : {
            result: false,
            data: null,
            owner: false,
            message: '게시글 카테고리 리스트 조회 실패'
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

  static create = async (categoryDto: CategorySaveDto) => {
    try {
      let created, categoryId;

      if (categoryDto.topcategoryId) {
        // 상위 카테고리가 주어진 경우
        const topLevel = Number(categoryDto.topcategoryId?.charAt(0));

        console.log(topLevel);
        //console.log(topLevel >= 0 || topLevel =< 2);

        if (isNaN(topLevel) || topLevel < 0 || topLevel >= 2) {
          throw new Error('상위 카테고리 레벨은 0또는 1이어야합니다.');
        }

        categoryId = Number(topLevel) + 1 + uuidv4().replace(/-/g, '');
        created = await db.query(
          `INSERT INTO Board_Category${Number(topLevel) + 1} (user_id, topcategory_id, category_id, category_name) VALUES (?,?,?,?) `,
          [
            categoryDto.userId,
            categoryDto.topcategoryId,
            categoryId,
            categoryDto.categoryName
          ]
        );
      } else {
        categoryId = 0 + uuidv4().replace(/-/g, '');
        created = await db.query(
          `INSERT INTO Board_Category0 (user_id, category_id, category_name) VALUES (?,?,?) `,
          [categoryDto.userId, categoryId, categoryDto.categoryName]
        );
      }

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

  private static _restore = async (categoryDto: CategorySaveDto) => {
    try {
      const level = Number(categoryDto.categoryId?.charAt(0));
      if (level < 0 || level > 2) {
        throw new Error('카테고리 레벨이 0 이상, 2 이하이어야 합니다.');
      }
      const restored =
        level === 0
          ? await db.query(
              `UPDATE Board_Category0 SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND category_name=?`,
              [categoryDto.userId, categoryDto.categoryName]
            )
          : await db.query(
              `UPDATE Board_Category${level} SET deleted_at = NULL, updated_at = CURRENT_TIMESTAMP  WHERE topcategory_id = ? AND category_name=?`,
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

  static modify = async (categoryDto: CategorySaveDto) => {
    try {
      const level = Number(categoryDto.categoryId?.charAt(0));
      if (level < 0 || level > 2) {
        throw new Error('카테고리 레벨이 0 이상, 2 이하이어야 합니다.');
      }
      const updated = await db.query(
        `UPDATE Board_Category${level} SET category_name = ? WHERE category_id =? AND user_id=?`,
        [categoryDto.categoryName, categoryDto.categoryId, categoryDto.userId]
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
      let level = Number(categoryDto.categoryId?.charAt(0));
      if (level < 0 || level > 2) {
        throw new Error('카테고리 레벨이 0 이상, 2 이하이어야 합니다.');
      }
      let deleted = await db.query(
        `UPDATE Board_Category${level} SET deleted_at = CURRENT_TIMESTAMP WHERE category_id = ? AND user_id= ? AND deleted_at IS NULL`,
        [categoryDto.categoryId, categoryDto.userId]
      );

      if (deleted.affectedRows === 0) {
        return { result: false, message: '카테고리 삭제 실패' };
      }

      level++;

      while (level > 0 && level <= 2) {
        // 하위 카테고리도 모두 삭제
        deleted = await db.query(
          `UPDATE Board_Category${level} SET deleted_at = CURRENT_TIMESTAMP WHERE topcategory_id = ? AND deleted_at IS NULL`,
          [categoryDto.categoryId]
        );
        if (deleted.affectedRows === 0) break;
        level++;
      }

      return { result: true, message: '카테고리 삭제 성공' };
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
