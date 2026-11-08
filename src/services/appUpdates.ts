import { App } from '@capacitor/app';
import { nativeAppUpdater } from './nativeAppUpdater';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface AndroidRelease {
  version: string;
  build: number;
  url: string;
  notes: string;
  sha256: string;
  size: number;
  id: string;
}
export interface AppUpdateState {
  supported: boolean;
  checking: boolean;
  currentVersion: string;
  currentBuild: number;
  release: AndroidRelease | null;
  dismissed: boolean;
  error: string | null;
  checkedAt: number | null;
  automatic: boolean;
}

export const ANDROID_RELEASES_API = 'https://painel-moto-three.vercel.app/downloads/latest.json';
const DISMISS_KEY = 'nw:android-update-dismiss:v1';
const AUTOMATIC_KEY = 'nw:android-update-automatic:v1';
function automaticUpdatesEnabled() {
  try { return localStorage.getItem(AUTOMATIC_KEY) !== 'false'; } catch { return true; }
}
const SUCCESS_INTERVAL = 6 * 60 * 60 * 1000;
const FAILURE_INTERVAL = 60 * 1000;
const RATE_LIMIT_INTERVAL = 30 * 60 * 1000;
const MAX_BUILD = 2147483647;

function validBuild(value: unknown): number | null {
  if (!/^\d+$/.test(String(value))) return null;
  const build = Number(value);
  return Number.isSafeInteger(build) && build > 0 && build <= MAX_BUILD ? build : null;
}

export function validAndroidDownloadUrl(value: unknown, version: string, build: number): value is string {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version) || validBuild(build) === null) return false;
  return value === `https://painel-moto-three.vercel.app/downloads/NovaesWeb-Entregador-v${version}-code${build}.apk`;
}

/** The release and APK are published together on the app's own hosting. */
export function selectAndroidRelease(data: unknown, currentBuild: number): AndroidRelease | null {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('Manifesto de atualização inválido.');
  const release = data as Record<string, unknown>;
  const version = release.version;
  const build = release.build;
  if (typeof version !== 'string' || !/^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)$/.test(version) ||
      typeof build !== 'number' || validBuild(build) === null ||
      release.file !== `NovaesWeb-Entregador-v${version}-code${build}.apk` ||
      typeof release.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(release.sha256) ||
      typeof release.size !== 'number' || !Number.isSafeInteger(release.size) || release.size < 1 || release.size > 100 * 1024 * 1024) throw new Error('Manifesto de atualização incompleto.');
  if (build <= currentBuild) return null;
  return { version, build, url: `https://painel-moto-three.vercel.app/downloads/${release.file}`,
    sha256: release.sha256, size: release.size,
    id: `hosted:${build}:${release.sha256}`, notes: typeof release.notes === 'string' ? release.notes.slice(0, 180) : '' };
}

function bounded<T>(promise: Promise<T>, milliseconds: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Tempo de consulta excedido.')), milliseconds);
    promise.then(value => { clearTimeout(timeout); resolve(value); }, error => { clearTimeout(timeout); reject(error); });
  });
}

class AppUpdates {
  private state: AppUpdateState = {
    supported: Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android',
    checking: false, currentVersion: '', currentBuild: 0, release: null, dismissed: false, error: null, checkedAt: null, automatic: automaticUpdatesEnabled(),
  };
  private listeners = new Set<(state: AppUpdateState) => void>();
  private generation = 0;
  private users = 0;
  private pending: Promise<void> | null = null;
  private nextCheckAt = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onOnline = () => { void this.check(); };
  private onVisibility = () => { if (document.visibilityState === 'visible') void this.check(); };

  getState(): AppUpdateState { return { ...this.state, release: this.state.release ? { ...this.state.release } : null }; }
  subscribe(listener: (state: AppUpdateState) => void) {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  private notify() { for (const listener of this.listeners) listener(this.getState()); }
  setAutomatic(enabled: boolean) {
    try { localStorage.setItem(AUTOMATIC_KEY, String(enabled)); } catch {}
    this.state.automatic = enabled;
    this.notify();
    if (enabled) void this.check();
  }
  private isDismissed(release: AndroidRelease | null): boolean {
    if (!release) return false;
    try {
      const saved = JSON.parse(localStorage.getItem(DISMISS_KEY) || 'null');
      return saved?.id === release.id && saved?.build === release.build && Number.isFinite(saved.until) &&
        saved.until > Date.now() && saved.until <= Date.now() + 24 * 60 * 60 * 1000;
    } catch { return false; }
  }
  start() {
    if (!this.state.supported) return () => {};
    this.users++;
    if (this.users === 1) {
      this.generation++;
      window.addEventListener('online', this.onOnline);
      document.addEventListener('visibilitychange', this.onVisibility);
      this.timer = setInterval(() => { if (document.visibilityState !== 'hidden') void this.check(); }, FAILURE_INTERVAL);
      void this.check();
    }
    let released = false;
    return () => {
      if (released) return; released = true;
      this.users = Math.max(0, this.users - 1);
      if (this.users) return;
      this.generation++;
      this.pending = null;
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
      window.removeEventListener('online', this.onOnline);
      document.removeEventListener('visibilitychange', this.onVisibility);
      this.state.checking = false;
      this.notify();
    };
  }
  check(force = false): Promise<void> {
    if (!this.state.supported) return Promise.resolve();
    if (!force && !this.state.automatic) return Promise.resolve();
    if (this.pending) return this.pending;
    if (!force && Date.now() < this.nextCheckAt) {
      const dismissed = this.isDismissed(this.state.release);
      if (dismissed !== this.state.dismissed) { this.state.dismissed = dismissed; this.notify(); }
      return Promise.resolve();
    }
    const generation = this.generation;
    this.state.checking = true; this.state.error = null; this.notify();
    const operation = (async () => {
      let retryDelay = FAILURE_INTERVAL;
      try {
        if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('Sem conexão.');
        const info = await bounded(App.getInfo(), 5000);
        if (generation !== this.generation) return;
        const build = validBuild(info.build);
        if (info.id !== 'br.com.novaesweb.entregador' || build === null || typeof info.version !== 'string') throw new Error('Versão instalada indisponível.');
        this.state.currentBuild = build; this.state.currentVersion = info.version.slice(0, 40);
        if (this.state.release && this.state.release.build <= build) { this.state.release = null; this.state.dismissed = false; }
        const response = await bounded(CapacitorHttp.request({
          url: ANDROID_RELEASES_API, method: 'GET', headers: { Accept: 'application/json' },
          responseType: 'json', connectTimeout: 10000, readTimeout: 10000, disableRedirects: true,
        }), 12000);
        if (generation !== this.generation) return;
        if (response.status !== 200) {
          if (response.status === 403 || response.status === 429) retryDelay = RATE_LIMIT_INTERVAL;
          throw new Error('Consulta de atualização indisponível.');
        }
        const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
        this.state.release = selectAndroidRelease(data, build);
        this.state.dismissed = this.isDismissed(this.state.release);
        this.state.checkedAt = Date.now(); this.nextCheckAt = Date.now() + SUCCESS_INTERVAL;
      } catch {
        if (generation !== this.generation) return;
        this.state.error = 'Não foi possível verificar a atualização. Tente novamente quando tiver conexão.';
        this.nextCheckAt = Date.now() + retryDelay;
      } finally {
        if (generation === this.generation) { this.state.checking = false; this.notify(); }
      }
    })();
    this.pending = operation;
    void operation.finally(() => { if (this.pending === operation) this.pending = null; });
    return operation;
  }
  dismiss() {
    const release = this.state.release;
    if (!release) return;
    try { localStorage.setItem(DISMISS_KEY, JSON.stringify({ id: release.id, build: release.build, until: Date.now() + 24 * 60 * 60 * 1000 })); } catch {}
    this.state.dismissed = true; this.notify();
  }
  async openDownload(): Promise<void> {
    const release = this.state.release;
    if (!this.state.supported) throw new Error('O download de APK está disponível no aplicativo Android.');
    if (!release || release.build <= this.state.currentBuild || !validAndroidDownloadUrl(release.url, release.version, release.build)) throw new Error('Não há uma atualização válida disponível para baixar.');
    try {
      await nativeAppUpdater.start({ ...release });
    } catch {
      const message = 'Não foi possível iniciar o download no aplicativo. Confira sua conexão e tente novamente.';
      this.state.error = message; this.notify(); throw new Error(message);
    }
  }
}

export const appUpdates = new AppUpdates();
