import { App } from '@capacitor/app';
import { AppLauncher } from '@capacitor/app-launcher';
import { Capacitor, CapacitorHttp } from '@capacitor/core';

export interface AndroidRelease {
  version: string;
  build: number;
  url: string;
  notes: string;
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

export const ANDROID_RELEASES_API = 'https://api.github.com/repos/Lkazin/painel-moto/releases?per_page=10';
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
  if (typeof value !== 'string' || value !== value.trim() || /[\u0000-\u001f\u007f]/.test(value) || !/^\d+\.\d+\.\d+$/.test(version) || validBuild(build) === null) return false;
  try {
    const url = new URL(value);
    const parts = url.pathname.split('/');
    return url.origin === 'https://github.com' && !url.username && !url.password && !url.search && !url.hash &&
      parts.length === 7 && parts[1].toLowerCase() === 'lkazin' && parts[2].toLowerCase() === 'painel-moto' &&
      parts[3] === 'releases' && parts[4] === 'download' && parts[5] === `android-v${version}` &&
      parts[6] === `NovaesWeb-Entregador-v${version}-code${build}.apk`;
  } catch { return false; }
}

/** GitHub's actual published asset URL is the only source of a download link. */
export function selectAndroidRelease(data: unknown, currentBuild: number, now = Date.now()): AndroidRelease | null {
  if (!Array.isArray(data)) throw new Error('Resposta de atualização inválida.');
  let selected: AndroidRelease | null = null;
  for (const release of data.slice(0, 10)) {
    if (!release || release.draft !== false || release.prerelease !== false || !Array.isArray(release.assets)) continue;
    const tag = typeof release.tag_name === 'string' ? /^android-v((?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))$/.exec(release.tag_name) : null;
    const publishedAt = typeof release.published_at === 'string' ? Date.parse(release.published_at) : NaN;
    if (!tag || !Number.isFinite(publishedAt) || publishedAt > now + 5 * 60000 || !Number.isSafeInteger(release.id) || release.id <= 0) continue;
    const version = tag[1];
    for (const asset of release.assets.slice(0, 30)) {
      if (!asset || asset.state !== 'uploaded' || !Number.isSafeInteger(asset.id) || asset.id <= 0 || !Number.isSafeInteger(asset.size) || asset.size <= 0) continue;
      const match = typeof asset.name === 'string' ? /^NovaesWeb-Entregador-v(\d+\.\d+\.\d+)-code([1-9]\d*)\.apk$/.exec(asset.name) : null;
      const build = match ? validBuild(match[2]) : null;
      if (!match || match[1] !== version || build === null || build <= currentBuild || (selected && selected.build >= build) || !validAndroidDownloadUrl(asset.browser_download_url, version, build)) continue;
      selected = {
        version, build, url: asset.browser_download_url, id: `${release.id}:${asset.id}:${build}`,
        notes: typeof release.body === 'string' ? release.body.replace(/[\r\n\t]+/g, ' ').trim().slice(0, 180) : '',
      };
    }
  }
  return selected;
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
  private downloadAttempt = 0;
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
          url: ANDROID_RELEASES_API, method: 'GET', headers: { Accept: 'application/vnd.github+json' },
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
      // Renew GitHub's redirect on every tap; never reuse an expiring CDN URL.
      // Only our own query is added AFTER strict validation of the official asset.
      const downloadUrl = new URL(release.url);
      downloadUrl.searchParams.set('download', '1');
      downloadUrl.searchParams.set('nw_update', `${Date.now()}-${++this.downloadAttempt}`);
      const result = await AppLauncher.openUrl({ url: downloadUrl.toString() });
      if (!result.completed) throw new Error('Download indisponível.');
    } catch {
      const message = 'Não foi possível abrir o download. Confira sua conexão e tente novamente.';
      this.state.error = message; this.notify(); throw new Error(message);
    }
  }
}

export const appUpdates = new AppUpdates();
