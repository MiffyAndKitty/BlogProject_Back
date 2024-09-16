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
