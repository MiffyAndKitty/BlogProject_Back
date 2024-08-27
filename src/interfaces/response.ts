import { NotificationDto } from './notification';

export interface BasicResponse {
  result: boolean;
  message: string;
}

export interface SingleDataResponse extends BasicResponse {
  data: string;
}

export interface MultipleDataResponse<T> extends BasicResponse {
  data: Array<T>;
}

export interface MultipleUserDataResponse extends BasicResponse {
  data: { accessToken?: string; userEmail?: string };
}

export interface SingleNotificationResponse extends BasicResponse {
  notifications?: NotificationDto;
}

export interface MultipleNotificationResponse extends BasicResponse {
  notifications?: Record<string, NotificationDto | undefined>;
}

export interface ListResponse extends BasicResponse {
  data: Array<object> | null;
  total: {
    totalCount: number;
    totalPageCount: number;
  } | null;
}

export interface UserListResponse extends ListResponse {
  isWriter?: boolean;
}
