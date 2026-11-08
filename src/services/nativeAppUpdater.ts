import { Capacitor, registerPlugin } from '@capacitor/core';
import type { AndroidRelease } from './appUpdates';

export interface NativeDownloadStatus {
  state: 'idle' | 'downloading' | 'paused' | 'ready' | 'permission' | 'failed';
  progress: number | null;
  message: string | null;
  version?: string;
  build?: number;
}
interface NativeUpdater {
  start(release: { version: string; build: number; url: string; sha256: string; size: number }): Promise<NativeDownloadStatus>;
  status(): Promise<NativeDownloadStatus>;
  install(): Promise<NativeDownloadStatus>;
}
const plugin = registerPlugin<NativeUpdater>('DriverAppUpdater');
class NativeAppUpdater {
  private state: NativeDownloadStatus & { supported: boolean } = {
    supported: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android' && Capacitor.isPluginAvailable('DriverAppUpdater'),
    state: 'idle', progress: null, message: null,
  };
  private listeners = new Set<(state: ReturnType<NativeAppUpdater['getState']>) => void>();
  private pendingRefresh: Promise<void> | null = null;
  private pendingStart: Promise<void> | null = null;
  private pendingInstall: Promise<void> | null = null;
  private users = 0;
  private revision = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onVisible = () => { if (document.visibilityState === 'visible') void this.refresh(); };
  getState() { return { ...this.state }; }
  subscribe(listener: (state: ReturnType<NativeAppUpdater['getState']>) => void) {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  private notify() { this.listeners.forEach(listener => listener(this.getState())); }
  private apply(result: NativeDownloadStatus) {
    const states = ['idle', 'downloading', 'paused', 'ready', 'permission', 'failed'];
    if (!states.includes(result?.state)) throw new Error('Estado do download indisponível.');
    this.state = { supported: this.state.supported, state: result.state,
      progress: Number.isFinite(result.progress) ? Math.max(0, Math.min(100, result.progress!)) : null,
      message: typeof result.message === 'string' ? result.message.slice(0, 300) : null,
      version: result.version, build: result.build };
    this.notify();
  }
  refresh(): Promise<void> {
    if (!this.state.supported) return Promise.resolve();
    if (this.pendingRefresh) return this.pendingRefresh;
    const revision = this.revision;
    const operation = (async () => {
      try { const result = await plugin.status(); if (revision === this.revision) this.apply(result); }
      catch { if (revision === this.revision) { this.state.message = 'Não foi possível conferir o download. Toque para tentar novamente.'; this.notify(); } }
    })();
    this.pendingRefresh = operation;
    void operation.finally(() => { if (this.pendingRefresh === operation) this.pendingRefresh = null; });
    return operation;
  }
  start(release: AndroidRelease): Promise<void> {
    if (this.pendingStart) return this.pendingStart;
    this.revision++;
    const operation = (async () => {
      if (!this.state.supported) throw new Error('Instale a versão do aplicativo com download interno para continuar.');
      try {
        const expected = `https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v${release.version}-code${release.build}.apk`;
        if (!/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(release.version) || !Number.isSafeInteger(release.build) || release.build < 1 || release.build > 2147483647 || release.url !== expected || !/^[a-f0-9]{64}$/.test(release.sha256) || !Number.isSafeInteger(release.size) || release.size < 1 || release.size > 100 * 1024 * 1024) throw new Error('Atualização inválida. Confira a versão disponível novamente.');
        this.apply(await plugin.start({ version: release.version, build: release.build, url: release.url, sha256: release.sha256, size: release.size }));
        if (this.state.state === 'failed') throw new Error(this.state.message || 'Não foi possível baixar a atualização.');
      } catch {
        this.state.state = 'failed'; this.state.message = 'Não foi possível baixar a atualização. Confira sua conexão e tente novamente.'; this.notify();
        throw new Error(this.state.message);
      }
    })();
    this.pendingStart = operation;
    void operation.finally(() => { if (this.pendingStart === operation) this.pendingStart = null; }).catch(() => {});
    return operation;
  }
  install(): Promise<void> {
    if (this.pendingInstall) return this.pendingInstall;
    if (!this.state.supported || !['ready', 'permission'].includes(this.state.state)) return Promise.reject(new Error('Aguarde o download e a verificação do arquivo.'));
    this.revision++;
    const operation = (async () => {
      try { this.apply(await plugin.install()); }
      catch { this.state.message = 'Não foi possível abrir a instalação. Confira a autorização do Android e tente novamente.'; this.notify(); throw new Error(this.state.message); }
    })();
    this.pendingInstall = operation;
    void operation.finally(() => { if (this.pendingInstall === operation) this.pendingInstall = null; }).catch(() => {});
    return operation;
  }
  startRuntime() {
    if (!this.state.supported) return () => {};
    this.users++;
    if (this.users === 1) {
      void this.refresh();
      document.addEventListener('visibilitychange', this.onVisible);
      this.timer = setInterval(() => { if (document.visibilityState === 'visible' && ['downloading', 'paused'].includes(this.state.state)) void this.refresh(); }, 2000);
    }
    let stopped = false;
    return () => {
      if (stopped) return; stopped = true; this.users = Math.max(0, this.users - 1);
      if (this.users) return;
      if (this.timer !== null) clearInterval(this.timer);
      this.timer = null;
      document.removeEventListener('visibilitychange', this.onVisible);
    };
  }
}
export const nativeAppUpdater = new NativeAppUpdater();
