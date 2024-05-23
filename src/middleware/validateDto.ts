import { Request, Response, NextFunction } from 'express';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ClassType } from '../types';

export async function validateDto<T extends object>(
  definedClass: ClassType<T>,
  select?: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      let requestObject;
      switch (select) {
        case 'user':
          requestObject = req.user;
          break;
        default:
          requestObject = req.body;
          break;
      }
      const dto = plainToInstance(definedClass, requestObject);
      const validateError = await validate(dto);

      if (validateError.length > 0) {
        return res.status(400).send({
          result: false,
          message: `유효하지 않은 데이터 : ${validateError}`
        });
      } else {
        requestObject = dto;
        next();
      }
    } catch (err) {
      next(err);
    }
  };
}
