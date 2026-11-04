import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import {
  MapPin,
  Phone,
  Navigation,
  KeyRound,
  AlertTriangle,
  ArrowLeft,
  Store,
  Clock,
  Compass,
  FileText,
  MessageCircle
} from 'lucide-react';
import { Assignment } from '../types';
import { audioAlert } from '../utils/audioAlert';

interface ScreenActiveDeliveryProps {
  assignment: Assignment;
  onBack: () => void;
  onOpenPinConfirmation: (assignment: Assignment) => void;
  onRequestWithdraw: (assignment: Assignment) => void;
}

export const ScreenActiveDelivery: React.FC<ScreenActiveDeliveryProps> = ({
  assignment,
  onBack,
  onOpenPinConfirmation,
  onRequestWithdraw
}) => {
  const assignmentKey = assignment.assignmentId || assignment.id || assignment.orderId;
  const storageKey = `nw:gate-wait:${assignmentKey}`;
  const [waitingStartedAt, setWaitingStartedAt] = useState<number | null>(() => {
    if (assignment.waitingGateStartedAt) {
      const parsed = Date.parse(assignment.waitingGateStartedAt);
      if (Number.isFinite(parsed)) return parsed;
    }
    try {
      const local = localStorage.getItem(storageKey);
      return local ? Number(local) : null;
    } catch { return null; }
  });
  const [localExtraMinutes, setLocalExtraMinutes] = useState(0);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (assignment.waitingGateStartedAt) {
      const parsed = Date.parse(assignment.waitingGateStartedAt);
      if (Number.isFinite(parsed) && (!waitingStartedAt || parsed < waitingStartedAt)) {
        setWaitingStartedAt(parsed);
      }
    }
  }, [assignment.waitingGateStartedAt]);

  useEffect(() => {
    if (!waitingStartedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [waitingStartedAt]);

  const baseMinutes = assignment.waitingGateLimitMinutes || 5;
  const storeExtraMinutes = assignment.gateWaitExtendedMinutes || 0;
  const totalMinutes = baseMinutes + storeExtraMinutes + localExtraMinutes;
  const totalSeconds = totalMinutes * 60;
  const elapsedSeconds = waitingStartedAt ? Math.floor((now - waitingStartedAt) / 1000) : 0;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const isExpired = waitingStartedAt !== null && remainingSeconds === 0;
  const isWarning = waitingStartedAt !== null && remainingSeconds > 0 && remainingSeconds <= 60;
  const progressPercent = totalSeconds > 0 ? Math.min(100, (remainingSeconds / totalSeconds) * 100) : 0;

  const formatCountdown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleStartGateWait = () => {
    audioAlert.playClickSound();
    const timestamp = Date.now();
    setWaitingStartedAt(timestamp);
    try { localStorage.setItem(storageKey, String(timestamp)); } catch {}
    void api.setGateWait(assignment.assignmentId || assignment.id || '', new Date(timestamp).toISOString(), baseMinutes);
  };

  const handleExtend3Min = () => {
    audioAlert.playClickSound();
    setLocalExtraMinutes(prev => prev + 3);
  };

  const handleQuickIntercomWhatsApp = () => {
    if (!assignment.customerPhone) return;
    audioAlert.playClickSound();
    const raw = assignment.customerPhone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá ${assignment.customerName}! Sou o entregador da ${assignment.storeName || 'loja'} e estou no seu portão/portaria aguardando com o pedido #${assignment.orderNumber}.`);
    window.open(`https://wa.me/55${raw}?text=${msg}`, '_blank');
  };

  const fullAddress = `${assignment.address}, ${assignment.addressNumber}, ${assignment.neighborhood}, ${assignment.city}`;
  const encodedAddress = encodeURIComponent(fullAddress);

  const openWaze = () => {
    audioAlert.playClickSound();
    window.open(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`, '_blank');
  };

  const openGoogleMaps = () => {
    audioAlert.playClickSound();
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
  };

  const callCustomer = () => {
    if (!assignment.customerPhone) return;
    audioAlert.playClickSound();
    window.location.href = `tel:${assignment.customerPhone.replace(/[^0-9]/g, '')}`;
  };

  const openWhatsApp = () => {
    if (!assignment.customerPhone) return;
    audioAlert.playClickSound();
    const raw = assignment.customerPhone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Olá ${assignment.customerName}! Sou o entregador da Bella Pizza e estou com o seu pedido #${assignment.orderNumber} a caminho.`);
    window.open(`https://wa.me/55${raw}?text=${msg}`, '_blank');
  };

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Botão Superior Voltar à Rota */}
      <button
        onClick={onBack}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--text-muted)',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          fontWeight: 700,
          cursor: 'pointer',
          padding: '4px 0'
        }}
      >
        <ArrowLeft size={18} />
        <span>Voltar para Minha Rota</span>
      </button>

      {/* Banner de Identificação da Parada */}
      <div
        className="card-surface card-highlight"
        style={{
          borderLeft: '5px solid var(--nw-pink)',
          padding: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span
            style={{
              background: 'var(--nw-pink)',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: 900,
              padding: '4px 10px',
              borderRadius: '10px'
            }}
          >
            PARADA ATIVA
          </span>

          <span style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>
            {assignment.orderNumber}
          </span>
        </div>

        {/* Nome do Cliente */}
        <h1 style={{ fontSize: '24px', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px' }}>
          {assignment.customerName}
        </h1>

        {/* Endereço em Destaque Absoluto (Legibilidade em Luz Solar) */}
        <div
          style={{
            background: 'var(--bg-app)',
            border: '2px solid var(--border-strong)',
            borderRadius: '16px',
            padding: '16px',
            marginTop: '12px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <MapPin size={26} color="var(--nw-pink)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <p style={{ fontSize: '20px', fontWeight: 900, color: '#ffffff', lineHeight: 1.25 }}>
                {assignment.address}, {assignment.addressNumber}
              </p>
              {assignment.addressComplement && (
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#FFB3E0', marginTop: '4px' }}>
                  {assignment.addressComplement}
                </p>
              )}
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                {assignment.neighborhood} • {assignment.city}
              </p>
            </div>
          </div>
        </div>

        {/* Instruções Especiais / Observações de Entrega */}
        {assignment.instructions && (
          <div
            style={{
              marginTop: '12px',
              background: 'rgba(139, 47, 232, 0.1)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              padding: '12px',
              fontSize: '13px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px'
            }}
          >
            <FileText size={18} color="var(--nw-purple)" style={{ flexShrink: 0, marginTop: '1px' }} />
            <div>
              <strong style={{ color: '#FFB3E0', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
                Observação do Cliente:
              </strong>
              <span style={{ color: '#ffffff' }}>{assignment.instructions}</span>
            </div>
          </div>
        )}

        {/* Itens do Pedido */}
        <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
          🍕 <strong style={{ color: '#ffffff' }}>Itens:</strong> {assignment.itemsSummary}
        </div>
      </div>

      {/* Botões de Ação Externa: Navegação & Telefone (Suporte de Moto) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <button
          onClick={openWaze}
          className="btn-glove btn-glove-waze"
          style={{ height: '56px', fontSize: '15px' }}
        >
          <Compass size={22} />
          <span>Abrir no Waze</span>
        </button>

        <button
          onClick={openGoogleMaps}
          className="btn-glove btn-glove-maps"
          style={{ height: '56px', fontSize: '15px' }}
        >
          <Navigation size={22} />
          <span>Google Maps</span>
        </button>
      </div>

      {/* Contato Rápido com o Cliente: WhatsApp ou Ligação */}
      {assignment.customerPhone ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <button
            onClick={openWhatsApp}
            className="btn-glove"
            style={{
              height: '56px',
              fontSize: '14px',
              background: 'rgba(37, 211, 102, 0.15)',
              border: '1px solid rgba(37, 211, 102, 0.45)',
              color: '#25D366'
            }}
          >
            <MessageCircle size={22} />
            <span>WhatsApp</span>
          </button>

          <button
            onClick={callCustomer}
            className="btn-glove btn-glove-secondary"
            style={{ height: '56px', fontSize: '14px' }}
          >
            <Phone size={20} color="var(--nw-emerald)" />
            <span>Ligar</span>
          </button>
        </div>
      ) : (
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-subtle)' }}>
          Telefone do cliente não informado no cadastro do pedido
        </div>
      )}

      {/* Cronômetro de Espera no Portão (Integrado com a Loja) */}
      {!waitingStartedAt ? (
        <div
          className="card-surface"
          style={{
            padding: '14px 16px',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, var(--bg-card) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--nw-amber)" />
              <span style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff' }}>
                Tolerância no Portão
              </span>
            </div>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
              Tempo base: {baseMinutes} min
            </span>
          </div>

          <button
            type="button"
            onClick={handleStartGateWait}
            className="btn-glove btn-glove-warning"
            style={{ height: '52px', fontSize: '14px' }}
          >
            <Clock size={20} />
            <span>🔔 Cheguei no Portão • Iniciar Espera</span>
          </button>
        </div>
      ) : (
        <div
          className="card-surface"
          style={{
            padding: '16px',
            border: isExpired
              ? '2px solid var(--nw-red)'
              : isWarning
              ? '2px solid var(--nw-amber)'
              : '1.5px solid rgba(16, 185, 129, 0.45)',
            background: isExpired
              ? 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, var(--bg-card) 100%)'
              : isWarning
              ? 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, var(--bg-card) 100%)'
              : 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, var(--bg-card) 100%)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={20} color={isExpired ? 'var(--nw-red)' : isWarning ? 'var(--nw-amber)' : 'var(--nw-emerald)'} />
              <div>
                <strong style={{ fontSize: '14px', color: '#ffffff', display: 'block' }}>
                  {isExpired ? 'Tempo de Portão Esgotado' : 'Aguardando no Portão'}
                </strong>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Tolerância: {totalMinutes} min {storeExtraMinutes > 0 ? `(Loja deu +${storeExtraMinutes}m)` : ''}
                </span>
              </div>
            </div>
            <span
              style={{
                fontSize: '26px',
                fontWeight: 900,
                fontFamily: 'monospace',
                color: isExpired ? 'var(--nw-red)' : isWarning ? 'var(--nw-amber)' : 'var(--nw-emerald)'
              }}
            >
              {formatCountdown(remainingSeconds)}
            </span>
          </div>

          {/* Barra de Progresso Regressiva */}
          <div style={{ height: '6px', borderRadius: '4px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPercent}%`,
                background: isExpired ? 'var(--nw-red)' : isWarning ? 'var(--nw-amber)' : 'var(--nw-emerald)',
                transition: 'width 1s linear'
              }}
            />
          </div>

          {isExpired && (
            <p style={{ margin: 0, fontSize: '12px', color: '#fca5a5', fontWeight: 700, lineHeight: 1.35 }}>
              ⚠️ Tempo de espera esgotado! Se o cliente não atender, você pode registrar o problema ou acionar a loja abaixo.
            </p>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px' }}>
            <button
              type="button"
              onClick={handleExtend3Min}
              className="btn-glove btn-glove-secondary"
              style={{ height: '42px', fontSize: '12px' }}
            >
              ➕ Dar +3 min
            </button>
            <button
              type="button"
              onClick={handleQuickIntercomWhatsApp}
              className="btn-glove"
              style={{
                height: '42px',
                fontSize: '12px',
                background: 'rgba(37, 211, 102, 0.15)',
                border: '1px solid rgba(37, 211, 102, 0.45)',
                color: '#25D366'
              }}
            >
              💬 "No Portão"
            </button>
          </div>
        </div>
      )}

      {/* Botão Primário Gigante: Cheguei no Destino / Digitar PIN */}
      <div style={{ marginTop: '8px' }}>
        <button
          onClick={() => {
            audioAlert.playClickSound();
            onOpenPinConfirmation(assignment);
          }}
          className="btn-glove btn-glove-primary"
          style={{ height: '70px', fontSize: '19px' }}
        >
          <KeyRound size={26} strokeWidth={2.6} />
          <span>CHEGUEI NO DESTINO • DIGITAR PIN</span>
        </button>
      </div>

      {/* Botão de Problema na Entrega / Exceção / Cliente Ausente (Glove-friendly) */}
      <div style={{ marginTop: '8px' }}>
        <button
          type="button"
          onClick={() => {
            audioAlert.playClickSound();
            onRequestWithdraw(assignment);
          }}
          className="btn-glove btn-glove-warning"
          style={{ height: '56px', fontSize: '15px' }}
        >
          <AlertTriangle size={22} color="var(--nw-amber)" />
          <span>Relatar Problema • Cliente Ausente / Erro</span>
        </button>
      </div>
    </div>
  );
};
