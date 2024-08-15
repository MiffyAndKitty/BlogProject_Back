export interface CategoryDto {
  userId: string;
  categoryId?: string;
  topcategoryId?: string;
  categoryName?: string;
}

export interface CategoryOwnerDto {
  nickname: string;
}

export interface CategoryListDto extends CategoryOwnerDto {
  userId?: string;
  topcategoryId?: string;
}

export interface HierarchicalCategoryDto {
  // 게시글 리스트 정렬 서비스 함수
  category_id: string;
  category_name: string;
  topcategory_id?: string;
  subcategories?: HierarchicalCategoryDto[];
  board_count: number;
}
