import React, { useEffect, useState } from 'react';
import { Navigation, MapPin, WifiOff } from 'lucide-react';
import { trackingService } from '../services/trackingService';
import { TrackingSessionState } from '../types';
import { trackingPresentation } from '../services/trackingPresentation';

export default function TrackingBadge() {
  const [tracking, setTracking] = useState<TrackingSessionState>(trackingService.getState());
  const [permission, setPermission] = useState(trackingService.getPermissionStatus());
  const [online, setOnline] = useState(typeof navigator === 'undefined' || navigator.onLine !== false);
  const [now, setNow] = useState(Date.now);
  const [loadingGps, setLoadingGps] = useState(false);

  useEffect(() => {
    const unsubscribe = trackingService.subscribe(state => {
      setTracking(state);
      setPermission(trackingService.getPermissionStatus());
      setNow(Date.now());
    });
    const onConnection = () => { setOnline(navigator.onLine !== false); setNow(Date.now()); };
    const onVisibility = () => { if (document.visibilityState === 'visible') onConnection(); };
    const clock = setInterval(() => setNow(Date.now()), 5000);
    window.addEventListener('online', onConnection);
    window.addEventListener('offline', onConnection);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      unsubscribe(); clearInterval(clock);
      window.removeEventListener('online', onConnection);
      window.removeEventListener('offline', onConnection);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const state = trackingPresentation(tracking, permission, online, now);
  const fresh = state.kind === 'fresh';
  const color = fresh ? 'var(--nw-emerald)' : 'var(--text-muted)';
  async function refreshGps() {
    setLoadingGps(true);
    try { await trackingService.requestLocationPermission(); }
    finally { setLoadingGps(false); }
  }
  return <button type="button" onClick={refreshGps} disabled={loadingGps}
    aria-label={`${state.label}. ${state.detail} Toque para atualizar o GPS.`}
    style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 8, minHeight: 44, maxWidth: '100%', textAlign: 'left',
      padding: '8px 10px', borderRadius: 12, background: 'var(--bg-card)', border: '1px solid var(--border-strong)', color }}>
    {state.kind === 'offline' ? <WifiOff size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : fresh
      ? <Navigation size={16} style={{ flexShrink: 0, marginTop: 2 }} /> : <MapPin size={16} style={{ flexShrink: 0, marginTop: 2 }} />}
    <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
      <span role="status" aria-live="polite" style={{ fontSize: 12, fontWeight: 800 }}>{loadingGps ? 'Atualizando GPS…' : state.label}</span>
      <span style={{ fontSize: 11, fontWeight: 400, lineHeight: 1.5, color: 'var(--text-muted)', maxWidth: 320 }}>{state.detail}</span>
      {state.lastSentAt !== null && <span style={{ fontSize: 11, color: 'var(--text-subtle)' }}>Último envio confirmado: {new Date(state.lastSentAt).toLocaleTimeString('pt-BR')}</span>}
    </span>
  </button>;
}
