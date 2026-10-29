import React, { useEffect, useState } from 'react';
import {
  Bell,
  Clock,
  MapPin,
  DollarSign,
  Package,
  Volume2,
  VolumeX,
  CheckCircle2,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { Offer } from '../types';
import { audioAlert } from '../utils/audioAlert';

interface ModalOfferReceivedProps {
  offer: Offer;
  onAccept: (offerId: string) => void;
  onReject: (offerId: string) => void;
  onExpired: (offerId: string) => void;
}

export const ModalOfferReceived: React.FC<ModalOfferReceivedProps> = ({
  offer,
  onAccept,
  onReject,
  onExpired
}) => {
  const [secondsRemaining, setSecondsRemaining] = useState<number>(60);
  const [isMuted, setIsMuted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inicia alerta sonoro Web Audio e cronômetro de 60s
  useEffect(() => {
    audioAlert.startOfferAlert();

    const calculateRemaining = () => {
      const expiresAtMs = new Date(offer.expiresAt).getTime();
      const diff = Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000));
      return Math.min(60, diff);
    };

    setSecondsRemaining(calculateRemaining());

    const interval = setInterval(() => {
      const rem = calculateRemaining();
      setSecondsRemaining(rem);

      if (rem <= 0) {
        clearInterval(interval);
        audioAlert.stopOfferAlert();
        audioAlert.playErrorSound();
        onExpired(offer.offerId);
      }
    }, 1000);

    return () => {
      clearInterval(interval);
      audioAlert.stopOfferAlert();
    };
  }, [offer.offerId, offer.expiresAt, onExpired]);

  const handleToggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const muted = audioAlert.toggleMute();
    setIsMuted(muted);
  };

  const handleAccept = () => {
    if (isSubmitting || secondsRemaining <= 0) return;
    setIsSubmitting(true);
    audioAlert.stopOfferAlert();
    audioAlert.playSuccessSound();
    onAccept(offer.offerId);
  };

  const handleReject = () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    audioAlert.stopOfferAlert();
    audioAlert.playClickSound();
    onReject(offer.offerId);
  };

  const isUrgent = secondsRemaining <= 15;
  const progressPercent = (secondsRemaining / 60) * 100;

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          borderTop: isUrgent ? '4px solid var(--nw-red)' : '4px solid var(--nw-pink)',
          position: 'relative'
        }}
      >
        {/* Barra de Progresso Superior de 60s */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '4px',
            width: `${progressPercent}%`,
            background: isUrgent
              ? 'var(--nw-red)'
              : 'linear-gradient(90deg, var(--nw-pink), var(--nw-purple))',
            transition: 'width 1s linear'
          }}
        />

        {/* Topo do Card de Oferta */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                background: isUrgent ? 'var(--nw-red)' : 'var(--nw-emerald)',
                boxShadow: isUrgent ? '0 0 10px var(--nw-red)' : '0 0 10px var(--nw-emerald)'
              }}
            />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fbcfe8', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
              Nova Corrida Disparada
            </span>
          </div>

          {/* Botão de Silenciar Som */}
          <button
            onClick={handleToggleMute}
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: isMuted ? 'var(--nw-red)' : 'var(--nw-pink)',
              padding: '6px 12px',
              borderRadius: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{isMuted ? 'Mudo' : 'Silenciar'}</span>
          </button>
        </div>

        {/* Linha com Valor da Corrida e Timer Circular */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
            borderRadius: '20px',
            padding: '16px 20px',
            marginBottom: '16px'
          }}
        >
          <div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
              VALOR DA ENTREGA (LOJA)
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
              {offer.deliveryFee !== null ? (
                <span style={{ fontSize: '32px', fontWeight: 900, color: 'var(--nw-emerald)' }}>
                  R$ {offer.deliveryFee.toFixed(2).replace('.', ',')}
                </span>
              ) : (
                <span style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-subtle)' }}>
                  Valor não informado
                </span>
              )}
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>
              {offer.storeName} • {offer.orderNumber}
            </span>
          </div>

          {/* Círculo do Cronômetro 60 Segundos */}
          <div className="timer-circular-wrap">
            <svg className="timer-circular-svg" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="3.5"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke={isUrgent ? 'var(--nw-red)' : 'var(--nw-pink)'}
                strokeWidth="3.5"
                strokeDasharray={`${progressPercent}, 100`}
                strokeLinecap="round"
              />
            </svg>
            <div className="timer-circular-text" style={{ color: isUrgent ? 'var(--nw-red)' : '#ffffff' }}>
              {secondsRemaining}s
            </div>
          </div>
        </div>

        {/* Detalhes do Destino & Pacote */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              background: 'var(--bg-app)',
              padding: '12px 14px',
              borderRadius: '14px'
            }}
          >
            <MapPin size={22} color="var(--nw-pink)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                Endereço de Entrega
              </span>
              <p style={{ fontSize: '15px', fontWeight: 800, color: '#ffffff', lineHeight: 1.3 }}>
                {offer.customerAddress}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {offer.customerNeighborhood} • aprox. {offer.estimatedDistanceKm} km
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              background: 'var(--bg-app)',
              padding: '12px 14px',
              borderRadius: '14px'
            }}
          >
            <Package size={20} color="var(--nw-purple)" style={{ flexShrink: 0 }} />
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-subtle)', textTransform: 'uppercase' }}>
                Itens da Pizzaria
              </span>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#ffffff' }}>
                {offer.itemsSummary}
              </p>
            </div>
          </div>
        </div>

        {/* Botões Grandes para Uso com Luva / Suporte de Moto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleAccept}
            disabled={isSubmitting || secondsRemaining <= 0}
            className="btn-glove btn-glove-primary"
            style={{ height: '64px', fontSize: '18px' }}
          >
            <CheckCircle2 size={26} strokeWidth={2.6} />
            <span>ACEITAR CORRIDA ({secondsRemaining}s)</span>
          </button>

          <button
            onClick={handleReject}
            disabled={isSubmitting}
            className="btn-glove btn-glove-danger"
            style={{ height: '52px', fontSize: '15px' }}
          >
            <XCircle size={20} />
            <span>Recusar Oferta</span>
          </button>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '12px' }}>
          Se você recusar ou o tempo expirar, a oferta retorna ao despacho manual da pizzaria.
        </p>
      </div>
    </div>
  );
};
