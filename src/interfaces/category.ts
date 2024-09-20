export interface CategoryIdDto {
  userId: string;
  categoryId: string;
}

export interface CategoryListDto {
  userId?: string;
  topcategoryId?: string;
  nickname: string;
}

export interface HierarchicalCategoryDto {
  category_id: string;
  category_name: string;
  topcategory_id?: string;
  subcategories?: HierarchicalCategoryDto[];
  board_count: number;
}

export interface UpdateCategoryNameDto extends CategoryIdDto {
  categoryName: string;
}

export interface UpdateCategoryLevelDto extends CategoryIdDto {
  newTopCategoryId: string;
}

export interface NewCategoryDto {
  userId: string;
  categoryName: string;
  topcategoryId?: string;
}
