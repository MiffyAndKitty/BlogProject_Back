import { pool } from '../config/mariadb';

export const db = await pool.getConnection();

export async function dbConnector() {
  const rows = await db.query('SELECT NOW()');
  console.log('데이터 베이스 연결 완료 :', rows[0]['NOW()']);
}
