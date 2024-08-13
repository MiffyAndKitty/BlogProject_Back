export interface BoardInDBDto {
  board_id: string;
  user_id: string;
  category_id: string;
  category_name: string;
  board_title: string;
  board_content: string;
  board_view: number;
  board_like: number;
  board_public: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  board_order: number;
  board_comment: number;
  user_nickname: string;
  tags: string[];
  isLike: boolean;
  isWriter: boolean;
}
