import { client } from '../config/redis';

export const redisConnector = client
  .on('connect', () => {
    console.log('Redis 연결 완료');
  })
  .on('error', (err) => console.log('Redis 연결 오류', err));

const redisClient = await client.connect();

export const redis = redisClient.v4; // 기존 버전은 콜백기반 -> v4버전은 프로미스 기반
