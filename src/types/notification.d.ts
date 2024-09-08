import { NotificationType } from '../constants/notificationType';

export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];
