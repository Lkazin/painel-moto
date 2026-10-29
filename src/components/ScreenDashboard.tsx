import React, { useState } from 'react';
import {
  Power,
  Navigation,
  Package,
  TrendingUp,
  AlertCircle,
  Bell,
  Clock,
  ArrowRight,
  Sparkles,
  Info
} from 'lucide-react';
import { DriverSession, DriverPresence, Assignment } from '../types';
import { audioAlert } from '../utils/audioAlert';

interface ScreenDashboardProps {
  session: DriverSession;
  presence: DriverPresence;
  assignments: Assignment[];
  onTogglePresence: () => void;
  onNavigateToRoute: () => void;
  onNavigateToOrders: () => void;
  onTriggerSimulatedOffer: () => void;
}

export const ScreenDashboard: React.FC<ScreenDashboardProps> = ({
  session,
  presence,
  assignments,
  onTogglePresence,
  onNavigateToRoute,
  onNavigateToOrders,
  onTriggerSimulatedOffer
}) => {
  const [toggleLoading, setToggleLoading] = useState(false);

  const activeDeliveries = assignments.filter(
    (a) => a.status === 'picked_up' || a.status === 'in_transit'
  );
  const waitingPickup = assignments.filter((a) => a.status === 'waiting_pickup');

  // Cálculo de ganhos das entregas do dia
  const completedTodayCount = 3;
  const earningsEstimated = 44.5;

  const handlePresenceClick = () => {
    setToggleLoading(true);
    audioAlert.playClickSound();
    setTimeout(() => {
      onTogglePresence();
      setToggleLoading(false);
    }, 150);
  };

  const isAvailable = presence.manualEnabled && presence.isOnline;

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Botão Gigante de Presença / Disponibilidade (Adequado para Luva no Suporte) */}
      <div className="card-surface" style={{ padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          Status de Disponibilidade para Ofertas
        </p>

        <button
          onClick={handlePresenceClick}
          disabled={toggleLoading}
          className={`btn-glove ${isAvailable ? 'btn-glove-primary' : 'btn-glove-secondary'}`}
          style={{
            height: '76px',
            fontSize: '18px',
            border: isAvailable ? 'none' : '2px solid rgba(239, 68, 68, 0.4)',
            boxShadow: isAvailable ? '0 8px 30px var(--nw-emerald-glow)' : 'none'
          }}
        >
          <Power size={28} strokeWidth={2.8} />
          <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, lineHeight: 1.1 }}>
              {isAvailable ? 'LIGADO • DISPONÍVEL' : 'DESLIGADO • PAUSADO'}
            </span>
            <span style={{ fontSize: '11px', fontWeight: 600, opacity: 0.85 }}>
              {isAvailable
                ? 'Pronto para receber corridas da Bella Pizza'
                : 'Toque para ligar e receber novas ofertas'}
            </span>
          </div>
        </button>

        {!presence.isOnline && (
          <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#fca5a5', fontSize: '12px', fontWeight: 700 }}>
            <AlertCircle size={15} />
            <span>Sem internet: loja visualiza entregador como indisponível</span>
          </div>
        )}
      </div>

      {/* Rota Ativa em Andamento (Aparece se houver entregas retiradas) */}
      {activeDeliveries.length > 0 && (
        <div
          className="card-surface card-highlight"
          style={{
            borderLeft: '4px solid var(--nw-pink)',
            background: 'linear-gradient(135deg, rgba(236,72,153,0.15), var(--bg-card))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Navigation size={22} color="var(--nw-pink)" />
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Rota em Execução</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {activeDeliveries.length} {activeDeliveries.length === 1 ? 'parada pendente' : 'paradas pendentes'}
                </p>
              </div>
            </div>
            <span
              style={{
                background: 'var(--nw-pink)',
                color: '#fff',
                fontSize: '11px',
                fontWeight: 900,
                padding: '4px 10px',
                borderRadius: '12px'
              }}
            >
              EM ROTA
            </span>
          </div>

          <div style={{ padding: '10px 12px', background: 'var(--bg-app)', borderRadius: '12px', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-subtle)', display: 'block', fontSize: '11px', fontWeight: 700 }}>
              PARADA ATUAL:
            </span>
            <strong style={{ color: '#ffffff' }}>
              {activeDeliveries[0].orderNumber} — {activeDeliveries[0].customerName}
            </strong>
            <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '2px' }}>
              {activeDeliveries[0].address}, {activeDeliveries[0].addressNumber} • {activeDeliveries[0].neighborhood}
            </p>
          </div>

          <button onClick={onNavigateToRoute} className="btn-glove btn-glove-accent" style={{ height: '56px' }}>
            <Navigation size={20} />
            <span>Abrir Minha Rota & Navegar</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* Pedidos Aguardando Retirada no Balcão da Pizzaria */}
      {waitingPickup.length > 0 && (
        <div
          className="card-surface"
          style={{
            borderLeft: '4px solid var(--nw-amber)',
            background: 'linear-gradient(135deg, rgba(245,158,11,0.1), var(--bg-card))'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Package size={22} color="var(--nw-amber)" />
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: 800 }}>Retirada no Balcão</h3>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {waitingPickup.length} {waitingPickup.length === 1 ? 'pedido pronto' : 'pedidos prontos'} para conferência
                </p>
              </div>
            </div>
            <button
              onClick={onNavigateToOrders}
              style={{
                background: 'var(--nw-amber)',
                color: '#000',
                border: 'none',
                padding: '8px 14px',
                borderRadius: '12px',
                fontWeight: 800,
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Conferir & Retirar
            </button>
          </div>
        </div>
      )}

      {/* Resumo de Corridas do Dia & Ganhos Informados */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
        <div className="card-surface" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nw-purple)' }}>
            <Package size={18} />
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Entregas Hoje</span>
          </div>
          <span style={{ fontSize: '28px', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
            {completedTodayCount}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Concluídas com PIN</span>
        </div>

        <div className="card-surface" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nw-emerald)' }}>
            <TrendingUp size={18} />
            <span style={{ fontSize: '12px', fontWeight: 700 }}>Ganhos Inf.</span>
          </div>
          <span style={{ fontSize: '28px', fontWeight: 900, color: 'var(--nw-emerald)', marginTop: '4px' }}>
            R$ {earningsEstimated.toFixed(2).replace('.', ',')}
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Valores informados</span>
        </div>
      </div>

      {/* Nota Legal Obrigatória (Documento 02 - Seção 13) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          background: 'rgba(139, 92, 246, 0.08)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '12px',
          padding: '10px 12px',
          fontSize: '11px',
          color: 'var(--text-subtle)',
          lineHeight: 1.4
        }}
      >
        <Info size={16} color="var(--nw-purple)" style={{ flexShrink: 0, marginTop: '2px' }} />
        <span>
          O total apresentado soma apenas valores informados pelo lojista no despacho e não comprova pagamento formal.
        </span>
      </div>

      {/* Card de Teste de Bancada: Disparar Oferta Sonora */}
      <div
        className="card-surface"
        style={{
          border: '1px dashed var(--nw-purple)',
          background: 'rgba(30, 27, 75, 0.35)',
          padding: '14px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--nw-pink)" />
            <span style={{ fontSize: '13px', fontWeight: 800, color: '#fbcfe8' }}>
              Homologação de Oferta (60s)
            </span>
          </div>
          <span style={{ fontSize: '10px', background: 'var(--bg-elevated)', padding: '2px 6px', borderRadius: '6px', color: 'var(--text-subtle)' }}>
            Simulador
          </span>
        </div>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '10px' }}>
          Simule a loja disparando um pedido para você. Testa o alerta sonoro Web Audio e o card flutuante de 60 segundos.
        </p>
        <button
          onClick={onTriggerSimulatedOffer}
          className="btn-glove btn-glove-accent"
          style={{ height: '48px', fontSize: '14px' }}
        >
          <Bell size={18} />
          <span>Disparar Oferta de Teste (Bella Pizza)</span>
        </button>
      </div>
    </div>
  );
};
