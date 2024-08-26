export interface NotificationDto {
  id?: string;
  recipient?: string;
  trigger: string;
  type:
    | 'new-follower'
    | 'following-new-board'
    | 'board-new-comment'
    | 'board-new-like'
    | 'comment-reply'
    | 'broadcast';
  location?: string;
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
