import { db } from '../loaders/mariadb';
import { DbColumnDto } from '../dtos';
import { ensureError } from '../errors/ensureError';

export class UsersService {
  static isDuplicated = async (existDto: DbColumnDto) => {
    try {
      const query = `SELECT * FROM User WHERE ${existDto.column} = ? ;`;
      const values = [existDto.data];
      const rows = await db.query(query, values);

      if (rows.length === 0) {
        return { result: true, message: '사용 가능한 데이터' };
      } else {
        return { result: false, message: '이미 사용 중인 데이터' };
      }
    } catch (err) {
      const error = ensureError(err);
      console.log(error.message);
      return { result: false, message: error.message };
    }
  };
}
