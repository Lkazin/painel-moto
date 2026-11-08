import { Capacitor, registerPlugin } from '@capacitor/core';
import { LocalNotifications } from '@capacitor/local-notifications';
import { appUpdates, validAndroidDownloadUrl } from './appUpdates';

interface NativeStatus { enabled: boolean; permissionGranted: boolean; channelEnabled: boolean }
interface NativeUpdates {
  status(): Promise<NativeStatus>;
  configure(options: { enabled: boolean }): Promise<NativeStatus>;
  notifyAvailable(options: { version: string; build: number; url: string; releaseId: string }): Promise<{ delivered: boolean; reason?: string }>;
}
const nativeUpdates = registerPlugin<NativeUpdates>('DriverUpdateNotifications');
const KEY = 'nw:android-update-notifications:v1';
export interface UpdateNotificationState {
  supported: boolean;
  enabled: boolean;
  permission: 'granted' | 'denied' | 'prompt' | 'unavailable';
  channelEnabled: boolean | null;
  busy: boolean;
  error: string | null;
}
function storedEnabled() { try { return localStorage.getItem(KEY) !== 'false'; } catch { return true; } }
class UpdateNotificationManager {
  private state: UpdateNotificationState = {
    supported: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('DriverUpdateNotifications'),
    enabled: storedEnabled(), permission: 'unavailable', channelEnabled: null, busy: false, error: null,
  };
  private listeners = new Set<(state: UpdateNotificationState) => void>();
  private users = 0;
  private revision = 0;
  private refreshPending: Promise<void> | null = null;
  private operations: Promise<void> = Promise.resolve();
  private unsubscribe: (() => void) | null = null;
  private onVisible = () => { if (document.visibilityState === 'visible') void this.refresh(); };
  private onOnline = () => { void this.refresh(); };
  getState() { return { ...this.state }; }
  subscribe(listener: (state: UpdateNotificationState) => void) {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  private notify() { this.listeners.forEach(listener => listener(this.getState())); }
  private permission(value: string): UpdateNotificationState['permission'] { return value === 'granted' ? 'granted' : value === 'denied' ? 'denied' : 'prompt'; }
  /** Serialized native work prevents an older permission check from re-enabling a disabled worker. */
  private reconcile() {
    const operation = this.operations.catch(() => {}).then(async () => {
      if (!this.state.supported) return;
      const updates = appUpdates.getState();
      if (this.state.enabled && updates.automatic && this.state.permission === 'unavailable') return;
      const enabled = this.state.enabled && updates.automatic && this.state.permission === 'granted';
      const native = await nativeUpdates.configure({ enabled });
      this.state.channelEnabled = native.channelEnabled;
      // Never promote a blocked permission from a stale WebView status.
      if (!native.permissionGranted && this.state.permission === 'granted') this.state.permission = 'denied';
      const latest = appUpdates.getState();
      const release = latest.release;
      if (this.state.enabled && latest.automatic && this.state.permission === 'granted' && native.channelEnabled && release &&
          release.build > latest.currentBuild && validAndroidDownloadUrl(release.url, release.version, release.build)) {
        // No account, shift token, store identity or customer information is sent to the native worker.
        const result = await nativeUpdates.notifyAvailable({ version: release.version, build: release.build, url: release.url, releaseId: release.id });
        if (result.reason === 'channel_disabled') this.state.channelEnabled = false;
        else if (result.reason === 'permission_denied') this.state.permission = 'denied';
        else if (!result.delivered && ['unavailable', 'invalid_release'].includes(result.reason || '')) this.state.error = 'O aviso não pôde ser emitido no Android. Você pode atualizar pelo botão dentro do aplicativo.';
      }
      this.notify();
    });
    this.operations = operation.catch(() => { this.state.error = 'Não foi possível preparar o aviso no celular. Tente verificar a permissão novamente.'; this.notify(); });
    return this.operations;
  }
  refresh(): Promise<void> {
    if (!this.state.supported) return Promise.resolve();
    if (this.refreshPending) return this.refreshPending;
    const revision = this.revision;
    const operation = (async () => {
      try {
        const permission = await LocalNotifications.checkPermissions();
        if (revision !== this.revision) return;
        this.state.permission = this.permission(permission.display);
        const status = await nativeUpdates.status();
        if (revision !== this.revision) return;
        this.state.channelEnabled = status.channelEnabled;
        this.state.error = null;
        await this.reconcile();
      } catch { if (revision === this.revision) this.state.error = 'Não foi possível verificar os avisos do Android. Tente novamente.'; }
      this.notify();
    })();
    this.refreshPending = operation;
    void operation.finally(() => { if (this.refreshPending === operation) this.refreshPending = null; });
    return operation;
  }
  async setEnabled(enabled: boolean): Promise<void> {
    if (!this.state.supported) return;
    const revision = ++this.revision;
    this.state.enabled = enabled; this.state.busy = true; this.state.error = null;
    try { localStorage.setItem(KEY, String(enabled)); } catch { /* Session preference remains effective. */ }
    this.notify();
    try {
      if (enabled) {
        let result = await LocalNotifications.checkPermissions();
        if (revision !== this.revision) return;
        if (result.display !== 'granted') result = await LocalNotifications.requestPermissions();
        if (revision !== this.revision) return;
        this.state.permission = this.permission(result.display);
      }
      await this.reconcile();
    } catch { if (revision === this.revision) this.state.error = 'Não foi possível alterar o aviso no celular. Confira a permissão nas configurações do Android.'; }
    finally { if (revision === this.revision) { this.state.busy = false; this.notify(); } }
  }
  start() {
    if (!this.state.supported) return () => {};
    this.users++;
    if (this.users === 1) {
      this.unsubscribe = appUpdates.subscribe(() => { void this.reconcile(); });
      document.addEventListener('visibilitychange', this.onVisible);
      window.addEventListener('online', this.onOnline);
      void this.refresh();
    }
    let stopped = false;
    return () => {
      if (stopped) return; stopped = true;
      this.users = Math.max(0, this.users - 1);
      if (this.users) return;
      this.unsubscribe?.(); this.unsubscribe = null;
      document.removeEventListener('visibilitychange', this.onVisible);
      window.removeEventListener('online', this.onOnline);
      // Background work intentionally remains configured after the WebView closes.
    };
  }
}
export const updateNotifications = new UpdateNotificationManager();
