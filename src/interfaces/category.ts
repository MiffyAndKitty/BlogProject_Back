export interface CategoryDto {
  userId: string;
  categoryId?: string;
  topcategoryId?: string;
  categoryName?: string;
}

export interface CategoryListDto {
  nickname: string;
  userId?: string;
  topcategoryId?: string;
}
