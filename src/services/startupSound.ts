const STORAGE_KEY = 'nw:startup-sound:v1';
const OFFER_SOUND_KEY = 'nw:driver-offer-sound:v1';
const listeners = new Set<() => void>();
let enabled = false;
try { enabled = localStorage.getItem(STORAGE_KEY) === 'true'; } catch { /* Private storage can be unavailable. */ }

type Tone = [frequency: number, offset: number, duration: number, wave: OscillatorType, volume: number, target?: number];

/** Same three tones offered in settings; the opening uses the driver's saved choice (default: tecnológico). */
function openingTones(): Tone[] {
  let chosen = 'tech';
  try {
    const value = localStorage.getItem(OFFER_SOUND_KEY);
    if (value === 'classic' || value === 'soft' || value === 'tech') chosen = value;
  } catch { /* Keep the default. */ }
  if (chosen === 'soft') return [[660, 0, 0.18, 'sine', 0.2], [880, 0.2, 0.25, 'sine', 0.2]];
  if (chosen === 'classic') return [[987.77, 0, 0.18, 'sawtooth', 0.25], [1318.51, 0.12, 0.2, 'square', 0.25], [1479.98, 0.28, 0.37, 'sawtooth', 0.28, 1975.53]];
  return [[520, 0, 0.13, 'square', 0.2, 780], [780, 0.17, 0.13, 'square', 0.22, 1040], [1040, 0.34, 0.2, 'triangle', 0.26, 1560], [1318.5, 0.57, 0.26, 'sine', 0.24]];
}

/** A separate short opening tone; never touches order-alert audio or vibration. */
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
        let last: OscillatorNode | undefined;
        for (const [frequency, offset, duration, wave, volume, target] of openingTones()) {
          const oscillator = ctx.createOscillator();
          const gain = ctx.createGain();
          oscillator.type = wave;
          oscillator.frequency.setValueAtTime(frequency, now + offset);
          if (target) oscillator.frequency.exponentialRampToValueAtTime(target, now + offset + duration);
          gain.gain.setValueAtTime(volume, now + offset);
          gain.gain.exponentialRampToValueAtTime(0.001, now + offset + duration);
          oscillator.connect(gain); gain.connect(ctx.destination);
          oscillator.start(now + offset); oscillator.stop(now + offset + duration);
          last = oscillator;
        }
        if (last) last.onended = stop;
      };
      if (ctx.state === 'running') start();
      else void ctx.resume().then(() => { try { start(); } catch { stop(); } }).catch(stop);
    } catch { stop(); }
    return stop;
  },
};
