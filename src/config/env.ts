import dotenv from 'dotenv';

let path;

switch (process.env.NODE_ENV) {
  case 'development':
    path = '.env.dev';
    break;
  case 'production':
    path = '.env.prod';
    break;
  default:
    throw new Error('환경 변수 설정이 되지 않았습니다.');
}

dotenv.config({ path });
