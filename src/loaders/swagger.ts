import { specs } from '../config/swagger';
import swaggerUi from 'swagger-ui-express';

export function swaggerConnector() {
  return [swaggerUi.serve, swaggerUi.setup({ ...specs })];
}
