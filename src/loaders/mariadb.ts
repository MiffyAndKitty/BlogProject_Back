import { pool } from '../config/mariadb';

export async function dbConnector(): Promise<void> {
  await pool.getConnection();

  const rows = await pool.query('SELECT NOW()');
  console.log('데이터 베이스 연결 완료 :', rows[0]['NOW()']);
}
