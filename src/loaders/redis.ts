import { redisConfig } from '../config/redis';
import { Redis } from 'ioredis';

export const redis = new Redis(redisConfig);

export const redisConnector = redis
  .on('connect', () => {
    console.log('Redis 연결 완료');
  })
  .on('error', (err) => console.log('Redis 연결 오류', err));