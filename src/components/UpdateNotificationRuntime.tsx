import { useEffect } from 'react';
import { updateNotifications } from '../services/updateNotifications';

export function UpdateNotificationRuntime() {
  useEffect(() => updateNotifications.start(), []);
  return null;
}
