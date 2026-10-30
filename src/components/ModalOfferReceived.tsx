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
              {offer.totalOrdersGrouped > 1 ? `Oferta em Lote • ${offer.totalOrdersGrouped} Entregas` : 'Nova Corrida Disparada'}
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
            marginBottom: '14px'
          }}
        >
          <div>
            <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', display: 'block' }}>
              REPASSE AO ENTREGADOR
            </span>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '2px' }}>
              {offer.deliveryFee !== null && offer.deliveryFee !== undefined ? (
                <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--nw-emerald)' }}>
                  R$ {Number(offer.deliveryFee).toFixed(2).replace('.', ',')}
                </span>
              ) : (
                <span style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-subtle)' }}>
                  A combinar com a loja
                </span>
              )}
            </div>
            <span style={{ fontSize: '12px', fontWeight: 800, color: '#ffffff' }}>
              {offer.storeName}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--text-subtle)', display: 'block' }}>
              Retirada: {offer.storeAddress || 'Balcão da Pizzaria'}
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

        {/* Informação do Lote */}
        <div
          style={{
            background: 'rgba(236, 72, 153, 0.08)',
            border: '1px solid rgba(236, 72, 153, 0.25)',
            borderRadius: '14px',
            padding: '10px 14px',
            marginBottom: '14px',
            fontSize: '12px',
            color: '#fbcfe8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}
        >
          <span>
            {offer.totalOrdersGrouped > 1
              ? `Você recebeu uma oferta com ${offer.totalOrdersGrouped} entregas.`
              : 'Você recebeu uma oferta com 1 entrega.'}
          </span>
          <span style={{ fontWeight: 800, fontSize: '11px', color: 'var(--text-subtle)' }}>
            {offer.estimatedDistanceKm ? `Percurso ~ ${offer.estimatedDistanceKm} km` : 'Distância indisponível'}
          </span>
        </div>

        {/* Detalhes dos Destinos do Percurso */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto', marginBottom: '16px', paddingRight: '4px' }}>
          {offer.orders && offer.orders.length > 0 ? (
            offer.orders.map((ord, idx) => (
              <div
                key={ord.id || idx}
                style={{
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border-subtle)',
                  padding: '10px 12px',
                  borderRadius: '12px',
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start'
                }}
              >
                <div
                  style={{
                    background: 'var(--nw-pink)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 900,
                    borderRadius: '8px',
                    padding: '2px 7px',
                    marginTop: '2px',
                    flexShrink: 0
                  }}
                >
                  #{idx + 1}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                      {ord.orderNumber.startsWith('#') ? ord.orderNumber : `#${ord.orderNumber}`} • {ord.customerName}
                    </span>
                  </div>
                  <p style={{ fontSize: '12px', color: '#e4e4e7', marginTop: '2px', lineHeight: 1.2 }}>
                    {ord.customerAddress}
                  </p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    {ord.customerNeighborhood} • {ord.itemsSummary}
                  </p>
                </div>
              </div>
            ))
          ) : (
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
                  {offer.customerNeighborhood} • {offer.itemsSummary}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Botões Grandes para Uso com Luva / Suporte de Moto */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={handleAccept}
            disabled={isSubmitting || secondsRemaining <= 0}
            className="btn-glove btn-glove-primary"
            style={{ height: '62px', fontSize: '17px' }}
          >
            <CheckCircle2 size={24} strokeWidth={2.6} />
            <span>
              {offer.totalOrdersGrouped > 1
                ? `ACEITAR AS ${offer.totalOrdersGrouped} ENTREGAS (${secondsRemaining}s)`
                : `ACEITAR CORRIDA (${secondsRemaining}s)`}
            </span>
          </button>

          <button
            onClick={handleReject}
            disabled={isSubmitting}
            className="btn-glove btn-glove-danger"
            style={{ height: '48px', fontSize: '14px' }}
          >
            <XCircle size={18} />
            <span>Recusar Oferta</span>
          </button>
        </div>

        <p style={{ fontSize: '11px', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '10px' }}>
          O lojista escolhe os pedidos. Você aceita ou recusa o lote inteiro.
        </p>
      </div>
    </div>
  );
};
