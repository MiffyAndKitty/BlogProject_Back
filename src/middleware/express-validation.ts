import express from 'express';
import { ContextRunner } from 'express-validator';

export const validate = (validations: ContextRunner[]) => {
  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    // sequential processing, stops running validations chain if one fails.
    for (const validation of validations) {
      const result = await validation.run(req);
      if (!result.isEmpty()) {
        const errors = result
          .array()
          .map((error) => error.msg)
          .join(', ');
        return res.status(400).send({
          result: false,
          message: `데이터 유효성 검증 실패: ${errors}`
        });
      }
    }

    next();
  };
};
