export interface CommentDto {
  userId: string;
  boardId: string;
  commentContent: string;
  parentCommentId: string;
}

export interface CommentUpdateDto {
  userId: string;
  commentId: string;
  commentContent: string;
}

export interface CommentIdDto {
  userId: string;
  commentId: string;
}

export interface ParentCommentIdDto {
  userId?: string;
  parentCommentId: string;
  //cursor: string;
  //pageSize: number;
  //isBefore: boolean;
}

export interface CommentLikeDto extends CommentIdDto {
  isLike: boolean;
}
