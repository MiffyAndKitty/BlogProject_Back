export interface ListDto {
  sort?: string;
  tag?: string;
  cursor?: string;
  pageSize?: number;
  isBefore?: boolean;
}

export interface UserListDto extends ListDto {
  nickname: string;
  userId?: string;
  categoryId?: string;
}
