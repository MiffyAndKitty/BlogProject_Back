import { Request, Response, NextFunction } from 'express';
import { db } from '../loaders/mariadb';
import { mongodb } from '../loaders/mongodb';
import { ObjectId } from 'mongodb';

export const checkWriter = (isDraft: boolean = false) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.id;
      const boardId =
        req.params.boardId?.split(':')[1] ??
        req.body.boardId ??
        req.params.draftId?.split(':')[1] ??
        req.body.draftId;

      if (!userId || !boardId) {
        req.isWriter = false;
        return next();
      }

      let isWriter = false;
      if (isDraft) {
        const draftCollection = mongodb.db('board_db').collection('drafts');
        const count = await draftCollection.countDocuments({
          _id: new ObjectId(boardId),
          userId: userId
        });
        isWriter = count > 0;
      } else {
        const [board] = await db.query(
          'SELECT 1 FROM Board WHERE user_id = ? AND board_id = ? AND deleted_at IS NULL LIMIT 1',
          [userId, boardId]
        );
        isWriter = board ? true : false;
      }
      req.isWriter = isWriter;
      next();
    } catch (err) {
      next(err);
    }
  };
};
