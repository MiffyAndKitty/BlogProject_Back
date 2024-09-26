import { Request } from 'express';

export declare global {
  namespace Express {
    interface Request extends Request {
      id: string | undefined;
      tokenMessage: string | undefined;
      newAccessToken?: string;
      fileURL?: Array<string>;
      isWriter: boolean;
    }
  }
}
