export interface CategoryDto {
  userId: string;
  categoryId?: string;
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

export interface UpdateCategoryNameDto extends CategoryDto {
  categoryName: string;
}

export interface UpdateCategoryLevelDto extends CategoryDto {
  topcategoryId: string;
}

export interface NewCategoryDto {
  userId: string;
  categoryName: string;
  topcategoryId?: string;
}
