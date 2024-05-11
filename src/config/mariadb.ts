import 'dotenv/config';
import mariadb from 'mariadb';

export const pool = mariadb.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_USERPW,
  database: process.env.DB_DATABASE,
  timezone: '+09:00'
});
