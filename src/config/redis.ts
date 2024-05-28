import 'dotenv/config';
import { createClient } from 'redis';

export const client = createClient({
  socket: {
    port: parseInt(process.env.REDIS_PORT!),
    host: process.env.REDIS_HOST
  },
  password: process.env.REDIS_PASSWORD,
  legacyMode: true // 이전 버전과의 호환성 유지
});
