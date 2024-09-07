import { mongoClient } from '../config/mongodb';

export const mongodb = await mongoClient.connect();

export const mongoDbConnector = async () => {
  try {
    await mongodb.db('Board').command({ ping: 1 });
    console.log('MongoDB 연결 완료');
  } catch (error) {
    console.error('MongoDB 연결 실패:', error);
    await mongoClient.close(); // 오류 발생 시 클라이언트 연결 종료
  }
};
