export interface ListDto {
  sort?: string;
  tag?: string;
  cursor?: string;
  pageSize?: number;
}

export interface UserListDto extends ListDto {
  nickname: string;
  userId?: string;
  categoryId?: string;
}
