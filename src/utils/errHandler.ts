import { Response } from 'express';
import { ensureError } from '../errors/ensureError';

export function handleError(err: unknown, res: Response) {
  const error = ensureError(err);
  return res.status(error.code).send({
    result: false,
    message: error.message
  });
}
