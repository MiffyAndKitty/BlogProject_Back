export interface NotificationDto {
  recipient?: string;
  type:
    | 'new-follower'
    | 'following-new-board'
    | 'comment-on-board'
    | 'board-new-like'
    | 'reply-to-comment'
    | 'broadcast';
  trigger: {
    id: string;
    nickname: string;
    email: string;
    image: string;
  };
  location?: {
    boardId?: string;
    commentId?: string;
    boardTitle?: string;
    commentContent?: string;
  };
  id?: string;
}

export interface UserNotificationDto {
  userId: string;
  notificationId: string;
}

export interface NotificationListDto {
  userId: string;
  pageSize: number;
  cursor: string;
  isBefore: boolean;
}
