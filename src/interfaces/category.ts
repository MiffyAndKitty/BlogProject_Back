export interface CategoryDto {
  userId?: string;
  categoryId?: string;
  topcategoryId?: string;
}

export interface CategoryListDto extends CategoryDto {
  nickname: string;
}

export interface CategorySaveDto extends CategoryDto {
  categoryName: string;
}
