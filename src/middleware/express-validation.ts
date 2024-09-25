import express from 'express';
import { ContextRunner } from 'express-validator';
import { BadRequestError } from '../errors/badRequestError';

export const validate = (validations: ContextRunner[]) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    for (const validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) {
        const errors = result
          .array()
          .map((error) => error.msg)
          .join(', ');
        return next(new BadRequestError(`데이터 유효성 검증 실패: ${errors}`));
      }
    }

    next();
  };
};
