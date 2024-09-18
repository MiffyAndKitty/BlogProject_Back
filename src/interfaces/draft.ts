import { ObjectId } from 'mongodb';

export interface DraftDto {
  userId: string;
  draftId?: string;
  title?: string;
  content?: string;
  public?: boolean;
  tagNames?: Array<string>;
  categoryId?: string;
  fileUrls?: Array<string>;
}

export interface UpdateDraftDto extends DraftDto {
  draftId: string;
}

export interface DraftIdDto {
  userId: string;
  draftId: string;
}

export interface DraftListDto {
  userId: string;
  cursor?: string;
  pageSize?: number;
  isBefore?: boolean;
}

export interface DraftFilterDto {
  userId?: string;
  updatedAt?: Date;
  _id?: ObjectId;
}

export interface DraftSortQueryDto {
  updatedAt?: number;
  _id?: number;
}
