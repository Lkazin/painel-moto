import React from 'react';
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
  FileText
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
                <p style={{ fontSize: '15px', fontWeight: 800, color: '#c084fc', marginTop: '4px' }}>
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
              background: 'rgba(139, 92, 246, 0.1)',
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
              <strong style={{ color: '#d8b4fe', display: 'block', fontSize: '11px', textTransform: 'uppercase' }}>
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

      {/* Botão de Ligar para o Cliente */}
      {assignment.customerPhone ? (
        <button
          onClick={callCustomer}
          className="btn-glove btn-glove-secondary"
          style={{ height: '56px', fontSize: '15px' }}
        >
          <Phone size={20} color="var(--nw-emerald)" />
          <span>Ligar para o Cliente ({assignment.customerPhone})</span>
        </button>
      ) : (
        <div style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-subtle)' }}>
          Telefone do cliente não informado no cadastro do pedido
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

      {/* Opção Secundária: Solicitar Desistência / Relatar Problema */}
      <div style={{ textAlign: 'center', marginTop: '6px' }}>
        <button
          onClick={() => onRequestWithdraw(assignment)}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-subtle)',
            fontSize: '12px',
            fontWeight: 700,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'underline'
          }}
        >
          <AlertTriangle size={15} color="var(--nw-amber)" />
          <span>Cliente ausente ou problema na entrega? Solicitar à loja</span>
        </button>
      </div>
    </div>
  );
};
