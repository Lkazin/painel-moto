export type NoticeKind = 'offer' | 'info' | 'success' | 'error';
export interface InAppNoticeInput {
  id: string;
  kind: NoticeKind;
  title: string;
  message: string;
  expiresAt?: string | number;
  onOpen?: () => void;
}
export interface InAppNoticeItem extends Omit<InAppNoticeInput, 'expiresAt'> {
  expiresAt: number | null;
}
export interface InAppNoticeState {
  current: InAppNoticeItem | null;
  pendingCount: number;
  animated: boolean;
}
const PREFERENCE_KEY = 'nw:in-app-notices:animated:v1';
const DISPLAY_MS = 5500;

interface NoticeRuntime {
  now: () => number;
  schedule: (callback: () => void, delay: number) => ReturnType<typeof setTimeout>;
  cancel: (timer: ReturnType<typeof setTimeout>) => void;
  readPreference: () => string | null;
  writePreference: (value: string) => void;
}
const browserRuntime: NoticeRuntime = {
  now: () => Date.now(), schedule: (fn, ms) => setTimeout(fn, ms), cancel: timer => clearTimeout(timer),
  readPreference: () => { try { return localStorage.getItem(PREFERENCE_KEY); } catch { return null; } },
  writePreference: value => { try { localStorage.setItem(PREFERENCE_KEY, value); } catch { /* Private browsing may disable storage. */ } },
};

/** Presentation-only queue. It never acknowledges an offer or changes its server state. */
export class InAppNoticeQueue {
  private queue: InAppNoticeItem[] = [];
  private current: InAppNoticeItem | null = null;
  private seen = new Set<string>();
  private pausedDurations = new Map<string, number>();
  private listeners = new Set<(state: InAppNoticeState) => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private visible = false;
  private remaining = DISPLAY_MS;
  private shownAt = 0;
  private animated: boolean;
  private runtime: NoticeRuntime;

  constructor(runtime: NoticeRuntime = browserRuntime) {
    this.runtime = runtime;
    this.animated = runtime.readPreference() !== 'false';
  }
  getState(): InAppNoticeState {
    return { current: this.visible && this.current ? { ...this.current } : null, pendingCount: this.queue.length, animated: this.animated };
  }
  subscribe(listener: (state: InAppNoticeState) => void) {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  private notify() { for (const listener of this.listeners) listener(this.getState()); }
  private cancelTimer() { if (this.timer !== null) this.runtime.cancel(this.timer); this.timer = null; }
  private expired(item: InAppNoticeItem) { return item.expiresAt !== null && item.expiresAt <= this.runtime.now(); }
  private advance() {
    this.cancelTimer();
    this.queue = this.queue.filter(item => !this.expired(item));
    if (this.current && this.expired(this.current)) this.current = null;
    if (!this.current && this.visible) {
      this.current = this.queue.shift() || null;
      this.remaining = this.current ? this.pausedDurations.get(this.current.id) ?? DISPLAY_MS : DISPLAY_MS;
      if (this.current) this.pausedDurations.delete(this.current.id);
    }
    if (this.current && this.visible) {
      this.shownAt = this.runtime.now();
      const delay = this.current.kind === 'offer' ? this.current.expiresAt! - this.shownAt : Math.min(this.remaining, this.current.expiresAt === null ? Infinity : this.current.expiresAt - this.shownAt);
      this.timer = this.runtime.schedule(() => { this.current = null; this.advance(); }, Math.max(0, delay));
    }
    this.notify();
  }
  setVisible(visible: boolean) {
    if (visible === this.visible) return;
    if (this.visible && this.current && this.current.kind !== 'offer') this.remaining = Math.max(0, this.remaining - (this.runtime.now() - this.shownAt));
    this.visible = visible;
    this.advance();
  }
  publish(input: InAppNoticeInput): boolean {
    if (!input.id || this.seen.has(input.id)) return false;
    const expiresAt = typeof input.expiresAt === 'number' ? input.expiresAt : typeof input.expiresAt === 'string' ? Date.parse(input.expiresAt) : null;
    if (expiresAt !== null && (!Number.isFinite(expiresAt) || expiresAt <= this.runtime.now())) return false;
    if (input.kind === 'offer' && expiresAt === null) return false;
    const item: InAppNoticeItem = { ...input, title: String(input.title || '').slice(0, 100), message: String(input.message || '').slice(0, 240), expiresAt };
    this.seen.add(input.id);
    if (this.seen.size > 1000) this.seen.delete(this.seen.values().next().value!);
    if (item.kind === 'offer') {
      if (this.current && this.current.kind !== 'offer') {
        const remaining = this.visible ? Math.max(0, this.remaining - (this.runtime.now() - this.shownAt)) : this.remaining;
        this.pausedDurations.set(this.current.id, remaining);
        this.queue.unshift(this.current); this.current = null;
      }
      const firstInfo = this.queue.findIndex(queued => queued.kind !== 'offer');
      this.queue.splice(firstInfo === -1 ? this.queue.length : firstInfo, 0, item);
    } else this.queue.push(item);
    // Publishing another notice must not reset the visible notice's display duration.
    if (this.current && this.visible && this.current.kind !== 'offer') this.remaining = Math.max(0, this.remaining - (this.runtime.now() - this.shownAt));
    this.advance();
    return true;
  }
  remove(id: string) {
    this.pausedDurations.delete(id);
    this.queue = this.queue.filter(item => item.id !== id);
    if (this.current?.id === id) this.current = null;
    else if (this.current && this.visible && this.current.kind !== 'offer') this.remaining = Math.max(0, this.remaining - (this.runtime.now() - this.shownAt));
    this.advance();
  }
  open(id: string) {
    if (!this.visible || this.current?.id !== id || this.expired(this.current)) return;
    const onOpen = this.current.onOpen;
    this.remove(id);
    onOpen?.();
  }
  clear() { this.cancelTimer(); this.queue = []; this.current = null; this.seen.clear(); this.pausedDurations.clear(); this.remaining = DISPLAY_MS; this.notify(); }
  getAnimated() { return this.animated; }
  setAnimated(value: boolean) { this.animated = value; this.runtime.writePreference(String(value)); this.notify(); }
}

const notices = new InAppNoticeQueue();
export const publishNotice = (input: InAppNoticeInput) => notices.publish(input);
export const clearNotices = () => notices.clear();
export const removeNotice = (id: string) => notices.remove(id);
export const dismissNotice = removeNotice;
export const openNotice = (id: string) => notices.open(id);
export const getAnimatedNotices = () => notices.getAnimated();
export const setAnimatedNotices = (enabled: boolean) => notices.setAnimated(enabled);
export const subscribeNotices = (listener: (state: InAppNoticeState) => void) => notices.subscribe(listener);

/** Mount only after validation; hidden pages never render or consume informative notices. */
export function startInAppNotices() {
  const update = () => notices.setVisible(document.visibilityState !== 'hidden');
  update();
  document.addEventListener('visibilitychange', update);
  return () => { document.removeEventListener('visibilitychange', update); notices.setVisible(false); };
}
