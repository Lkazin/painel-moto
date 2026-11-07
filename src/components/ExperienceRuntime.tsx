import { useEffect } from 'react';
import { hapticFeedback, useExperiencePreferences } from '../services/experiencePreferences';
import { subscribeNotices } from '../services/inAppNotices';
import './Experience.css';

export function ExperienceRuntime() {
  const { preferences } = useExperiencePreferences();
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      const root = document.documentElement;
      root.dataset.theme = preferences.theme === 'system' ? media.matches ? 'light' : 'dark' : preferences.theme;
      root.dataset.outdoor = String(preferences.outdoor);
      root.dataset.textScale = preferences.textScale;
      root.dataset.reducedMotion = String(preferences.reducedMotion || motion.matches);
    };
    apply(); media.addEventListener('change', apply); motion.addEventListener('change', apply);
    return () => { media.removeEventListener('change', apply); motion.removeEventListener('change', apply); };
  }, [preferences]);
  useEffect(() => {
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button, summary, input[type="checkbox"]') : null;
      if (event.isTrusted && target && !target.hasAttribute('disabled') && !target.closest('[data-no-haptic]')) hapticFeedback();
    };
    let lastNotice = '';
    const unsubscribe = subscribeNotices(state => {
      if (state.current && state.current.id !== lastNotice) {
        lastNotice = state.current.id;
        if (state.current.kind === 'success') hapticFeedback('success');
        else if (state.current.kind === 'error') hapticFeedback('attention');
      }
    });
    document.addEventListener('click', click);
    return () => { document.removeEventListener('click', click); unsubscribe(); };
  }, []);
  return null;
}
