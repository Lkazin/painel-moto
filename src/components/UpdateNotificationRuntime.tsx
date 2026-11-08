import { useEffect } from 'react';
import { updateNotifications } from '../services/updateNotifications';
import { nativeAppUpdater } from '../services/nativeAppUpdater';
import { App } from '@capacitor/app';
import { appUpdates } from '../services/appUpdates';

export function UpdateNotificationRuntime() {
  useEffect(() => updateNotifications.start(), []);
  useEffect(() => nativeAppUpdater.startRuntime(), []);
  useEffect(() => {
    if (!nativeAppUpdater.getState().supported) return;
    let alive = true;
    let remove: (() => Promise<void>) | null = null;
    const open = (event: { url: string }) => {
      if (!alive || event.url !== 'novaesweb-entregador://updates') return;
      void appUpdates.check(true).then(() => { if (alive && appUpdates.getState().release) window.scrollTo({ top: 0, behavior: 'auto' }); });
    };
    void App.getLaunchUrl().then(event => { if (event) open(event); }).catch(() => {});
    void App.addListener('appUrlOpen', open).then(handle => {
      if (!alive) void handle.remove(); else remove = () => handle.remove();
    }).catch(() => {});
    return () => { alive = false; if (remove) void remove(); };
  }, []);
  return null;
}
