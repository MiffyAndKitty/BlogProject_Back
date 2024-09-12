import { NotificationName } from '../../constants/notificationName';
import { NotificationNameType } from '../../types/notification';

export function isNotificationNameType(
  value: any
): value is NotificationNameType {
  return Object.values(NotificationName).includes(value);
}
