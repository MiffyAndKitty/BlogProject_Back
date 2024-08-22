export interface ListDto {
  query?: string;
  sort?: string;
  tag?: string;
  cursor?: string;
  pageSize?: number;
  isBefore: boolean;
}

export interface UserListDto extends ListDto {
  nickname: string;
  userId?: string;
  categoryId?: string;
}

export interface SortOptions {
  pageSize: number;
  cursor?: string;
  isBefore?: boolean;
}

export interface ViewOrLikeSortOptions extends SortOptions {
  sort: 'view' | 'like';
}
