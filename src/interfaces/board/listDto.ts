export interface SortOptions {
  pageSize: number;
  cursor?: string;
  isBefore?: boolean;
}

// src/services/board/commentList.ts 에서 사용되는 DTO

export interface BoardCommentListDto extends SortOptions {
  userId?: string;
  boardId: string;
  sort?: string;
}

// src/services/board/boardList.ts 에서 사용되는 DTO

export interface ViewOrLikeSortOptions extends SortOptions {
  sort: 'view' | 'like';
}

export interface ListDto extends SortOptions {
  query?: string;
  sort?: string;
  tag?: string;
}

export interface UserListDto extends ListDto {
  nickname: string;
  userId?: string;
  categoryId?: string;
}
