import { flushSync } from 'react-dom';
import { prefersReducedMotion } from '../services/experiencePreferences';

export function transitionDelivery(change: () => void) {
  if (typeof document === 'undefined' || !document.startViewTransition || prefersReducedMotion()) { change(); return; }
  try {
    const transition = document.startViewTransition(() => { flushSync(change); });
    void transition.finished.catch(() => {});
  } catch { change(); }
}
