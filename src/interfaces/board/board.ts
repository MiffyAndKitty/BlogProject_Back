export interface boardDto {
  userId?: string;
  boardId?: string;
  title: string;
  content: string;
  public: boolean;
  tagNames?: Array<string>;
  categoryId?: string;
  fileUrls?: Array<string>;
}

export interface modifiedBoardDto extends boardDto {
  boardId: string;
}
