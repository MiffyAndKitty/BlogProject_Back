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
  // 게시글 리스트 정렬 서비스 함수
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
