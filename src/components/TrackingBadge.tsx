import React, { useEffect, useState } from 'react';
import { Navigation, MapPin, AlertCircle } from 'lucide-react';
import { trackingService } from '../services/trackingService';
import { TrackingSessionState } from '../types';

export default function TrackingBadge() {
  const [tracking, setTracking] = useState<TrackingSessionState>(trackingService.getState());
  const [loadingGps, setLoadingGps] = useState(false);

  useEffect(() => {
    const unsubscribe = trackingService.subscribe((state) => {
      setTracking(state);
    });
    return () => unsubscribe();
  }, []);

  const handleRequestGps = async () => {
    setLoadingGps(true);
    await trackingService.requestLocationPermission();
    setLoadingGps(false);
  };

  if (tracking.error || !tracking.lastLocation) {
    return (
      <button
        type="button"
        onClick={handleRequestGps}
        disabled={loadingGps}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 10px',
          borderRadius: '999px',
          background: 'rgba(245, 158, 11, 0.18)',
          border: '1px solid rgba(245, 158, 11, 0.5)',
          color: '#fde68a',
          fontSize: '11px',
          fontWeight: 800,
          cursor: 'pointer'
        }}
        title="Toque para permitir e atualizar sua localização GPS real"
      >
        <MapPin size={13} color="#f59e0b" />
        <span>{loadingGps ? 'Ativando GPS...' : 'Ativar GPS Real'}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRequestGps}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 10px',
        borderRadius: '999px',
        background: 'rgba(16, 185, 129, 0.15)',
        border: '1px solid rgba(16, 185, 129, 0.45)',
        color: '#6ee7b7',
        fontSize: '11px',
        fontWeight: 800,
        cursor: 'pointer'
      }}
      title="Sua localização real está sendo compartilhada com a loja e o cliente. Toque para atualizar agora."
    >
      <span
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: '#10b981',
          boxShadow: '0 0 8px #10b981'
        }}
      />
      <Navigation size={12} color="#34d399" />
      <span>GPS Ativo</span>
      {tracking.lastLocation?.accuracy && (
        <span style={{ fontSize: '10px', opacity: 0.85 }}>
          (±{Math.round(tracking.lastLocation.accuracy)}m)
        </span>
      )}
    </button>
  );
}
