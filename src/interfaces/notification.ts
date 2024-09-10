import { NotificationNameType } from '../types/notification';

export interface NotificationDto {
  recipient?: string;
  type: NotificationNameType;
  trigger: {
    id: string;
    nickname: string;
    email: string;
    image: string;
  };
  location?: {
    boardId?: string;
    parentCommentId?: string;
    commentId?: string;
    boardTitle?: string;
    commentContent?: string;
    boardWriterNickname?: string;
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
  sort: string;
}

export interface RetryFailedUsersResult {
  dbSaveFails: string[];
  notifyFails: string[];
}
