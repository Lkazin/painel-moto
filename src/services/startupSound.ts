const STORAGE_KEY = 'nw:startup-sound:v1';
const listeners = new Set<() => void>();
let enabled = false;
try { enabled = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* Private storage can be unavailable. */ }

/** A separate short engine synth; never touches order-alert audio or vibration. */
export const startupSound = {
  getEnabled: () => enabled,
  setEnabled(value: boolean) {
    enabled = value;
    try { localStorage.setItem(STORAGE_KEY, String(value)); } catch { /* Keep this session's preference. */ }
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
  play(): () => void {
    if (!enabled || typeof window === 'undefined') return () => {};
    let context: AudioContext | undefined;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      clearTimeout(timer);
      if (context) void context.close().catch(() => {});
    };
    try {
      const Audio = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Audio) return stop;
      context = new Audio();
      const ctx = context;
      timer = setTimeout(stop, 1900);
      const start = () => {
        if (stopped || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        const engine = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        engine.type = 'sawtooth';
        engine.frequency.setValueAtTime(48, now);
        engine.frequency.exponentialRampToValueAtTime(145, now + 1.1);
        engine.frequency.exponentialRampToValueAtTime(72, now + 1.65);
        filter.type = 'lowpass'; filter.frequency.setValueAtTime(420, now);
        filter.frequency.linearRampToValueAtTime(950, now + 1.1);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.055, now + 0.12);
        gain.gain.linearRampToValueAtTime(0.035, now + 1.2);
        gain.gain.linearRampToValueAtTime(0, now + 1.75);
        engine.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        engine.onended = stop;
        engine.start(now); engine.stop(now + 1.8);
      };
      if (ctx.state === 'running') start();
      else void ctx.resume().then(() => { try { start(); } catch { stop(); } }).catch(stop);
    } catch { stop(); }
    return stop;
  },
};
