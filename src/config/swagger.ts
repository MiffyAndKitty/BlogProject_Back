import '../config/env';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadAndCombineYamlFiles } from '../utils/loadYamlFiles'; // 추가된 부분

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const combinedPaths = loadAndCombineYamlFiles(
  path.join(__dirname, '../swagger')
);

export const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'MK-blog API docs',
    description: 'SOPT SERVER SEMINAR',
    license: {
      name: ''
    }
  },
  servers: [
    {
      url: process.env.ORIGIN_URL
    }
  ],
  paths: combinedPaths
};

export const specs = swaggerJsdoc({
  swaggerDefinition,
  apis: ['../routes/*.ts']
});
