import { useSyncExternalStore } from 'react';

export interface ExperiencePreferences {
  theme: 'dark' | 'light' | 'system';
  textScale: 'normal' | 'large';
  outdoor: boolean;
  focus: boolean;
  haptics: boolean;
  reducedMotion: boolean;
}
const KEY = 'nw:driver-experience:v1';
const defaults: ExperiencePreferences = { theme: 'dark', textScale: 'normal', outdoor: false, focus: false, haptics: true, reducedMotion: false };
export function normalizeExperience(value: unknown): ExperiencePreferences {
  const data = value && typeof value === 'object' ? value as Partial<ExperiencePreferences> : {};
  return {
    theme: ['dark', 'light', 'system'].includes(data.theme || '') ? data.theme! : defaults.theme,
    textScale: data.textScale === 'large' ? 'large' : 'normal',
    outdoor: data.outdoor === true, focus: data.focus === true,
    haptics: data.haptics !== false, reducedMotion: data.reducedMotion === true,
  };
}
function read(): ExperiencePreferences {
  try { return normalizeExperience(JSON.parse(localStorage.getItem(KEY) || 'null')); }
  catch { return { ...defaults }; }
}
let current = read();
const listeners = new Set<() => void>();
export function getExperiencePreferences() { return current; }
export function updatePreferences(changes: Partial<ExperiencePreferences>) {
  current = normalizeExperience({ ...current, ...changes });
  try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* Preferences still work for this session. */ }
  listeners.forEach(listener => listener());
}
export function subscribeExperience(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function useExperiencePreferences() {
  const preferences = useSyncExternalStore(subscribeExperience, getExperiencePreferences, getExperiencePreferences);
  return { preferences, updatePreferences };
}
export function prefersReducedMotion() {
  return current.reducedMotion || (typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches));
}
export function hapticFeedback(kind: 'selection' | 'success' | 'attention' = 'selection'): boolean {
  if (!current.haptics || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') return false;
  try { return navigator.vibrate(kind === 'success' ? [15, 45, 25] : kind === 'attention' ? [35, 40, 35] : 8); }
  catch { return false; }
}
