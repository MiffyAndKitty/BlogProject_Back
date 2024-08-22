import { Request, Response, NextFunction } from 'express';
import { db } from '../loaders/mariadb';

export const checkWriter = () => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.id;
      const boardId = req.params.boardId?.split(':')[1] ?? req.body.boardId;

      req.isWriter = false;

      if (!userId || !boardId) return next();

      const existed = await db.query(
        'SELECT * FROM Board WHERE user_id = ? AND board_id = ? AND deleted_at IS NULL LIMIT 1',
        [userId, boardId]
      );
      if (existed.length > 0) req.isWriter = true;
      next();
    } catch (err) {
      next(err);
    }
  };
};
