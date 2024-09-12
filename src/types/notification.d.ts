import { NotificationName } from '../constants/notificationName';

export type NotificationNameType =
  (typeof NotificationName)[keyof typeof NotificationName];
