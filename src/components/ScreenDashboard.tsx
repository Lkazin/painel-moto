import React, { useState } from 'react';
import {
  Power,
  Navigation,
  Package,
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Info,
  Smartphone,
  BellRing,
  ShieldCheck
} from 'lucide-react';
import { DriverSession, DriverPresence, Assignment } from '../types';
import { audioAlert } from '../utils/audioAlert';
import { requestNotificationPermission, getNotificationPermission } from '../utils/mobileWake';

interface ScreenDashboardProps {
  session: DriverSession;
  presence: DriverPresence;
  assignments: Assignment[];
  completedTodayCount: number;
  earningsEstimated: number;
  onTogglePresence: () => void;
  onNavigateToRoute: () => void;
  onNavigateToOrders: () => void;
}

export const ScreenDashboard: React.FC<ScreenDashboardProps> = ({
  session,
  presence,
  assignments,
  completedTodayCount,
  earningsEstimated,
  onTogglePresence,
  onNavigateToRoute,
  onNavigateToOrders
}) => {
  const [toggleLoading, setToggleLoading] = useState(false);

  const activeDeliveries = assignments.filter(
    (a) => a.status === 'picked_up' || a.status === 'in_transit'
  );
  const waitingPickup = assignments.filter((a) => a.status === 'waiting_pickup');

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
                ? `Pronto para receber corridas de ${session.storeName}`
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

      {/* Resumo Real de Corridas e Ganhos */}
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

      {/* Card de Ativação de Notificações com Tela Bloqueada */}
      <NotificationPermissionCard />

      {/* Banner de Instalação do Aplicativo (PWA) no Celular */}
      <PwaInstallCard />

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
    </div>
  );
};

// Componente de Permissão de Notificações com Celular Bloqueado
const NotificationPermissionCard: React.FC = () => {
  const [permission, setPermission] = React.useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');

  React.useEffect(() => {
    setPermission(getNotificationPermission());
  }, []);

  if (permission === 'unsupported' || permission === 'granted') {
    return null;
  }

  const handleEnable = async () => {
    audioAlert.playClickSound();
    const granted = await requestNotificationPermission();
    setPermission(granted ? 'granted' : 'denied');
  };

  return (
    <div
      className="card-surface"
      style={{
        padding: '14px 16px',
        border: '1px solid rgba(245, 158, 11, 0.45)',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(217, 119, 6, 0.05) 100%)',
        borderRadius: '16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              backgroundColor: '#d97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0
            }}
          >
            <BellRing size={20} />
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', margin: 0 }}>
              Alertas na Tela Bloqueada
            </h4>
            <p style={{ fontSize: '11px', color: '#fde68a', margin: '2px 0 0 0' }}>
              Ative para o celular vibrar e tocar sirene mesmo no bolso ou bloqueado
            </p>
          </div>
        </div>

        <button
          onClick={handleEnable}
          style={{
            background: '#d97706',
            color: '#ffffff',
            border: 'none',
            padding: '10px 14px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(217, 119, 6, 0.4)'
          }}
        >
          {permission === 'denied' ? 'Ver Como' : 'Ativar'}
        </button>
      </div>

      {permission === 'denied' && (
        <p style={{ fontSize: '11px', color: '#fca5a5', marginTop: '8px', lineHeight: 1.4, margin: '8px 0 0 0' }}>
          ⚠️ Notificações foram bloqueadas no navegador. Para reativar, clique no cadeado da barra de endereço e marque &quot;Notificações&quot; como Permitir.
        </p>
      )}
    </div>
  );
};

// Componente de Instalação PWA
const PwaInstallCard: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = React.useState<any>(null);
  const [isInstalled, setIsInstalled] = React.useState<boolean>(false);
  const [isIos, setIsIos] = React.useState<boolean>(false);
  const [showIosInstructions, setShowIosInstructions] = React.useState<boolean>(false);

  React.useEffect(() => {
    // Detectar se já está rodando instalado como standalone PWA
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

    // Detectar iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        setIsInstalled(true);
      }
      setDeferredPrompt(null);
    } else if (isIos) {
      setShowIosInstructions(!showIosInstructions);
    }
  };

  if (isInstalled) return null;

  return (
    <div
      className="card-surface"
      style={{
        padding: '16px',
        border: '1px solid rgba(236, 72, 153, 0.35)',
        background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.08) 0%, rgba(139, 92, 246, 0.08) 100%)',
        borderRadius: '16px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'var(--nw-pink)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              flexShrink: 0
            }}
          >
            <Smartphone size={22} />
          </div>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', margin: 0 }}>
              Instalar App no Celular
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Acesso rápido na tela inicial, tela cheia e som alto sem barra de navegador
            </p>
          </div>
        </div>

        <button
          onClick={handleInstallClick}
          style={{
            background: 'var(--nw-pink)',
            color: '#ffffff',
            border: 'none',
            padding: '10px 16px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)'
          }}
        >
          {isIos ? (showIosInstructions ? 'Fechar' : 'Como Instalar') : 'Instalar'}
        </button>
      </div>

      {showIosInstructions && isIos && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5
          }}
        >
          <p style={{ margin: '0 0 6px 0', fontWeight: 700, color: '#ffffff' }}>No iPhone / Safari:</p>
          <ol style={{ margin: 0, paddingLeft: '18px' }}>
            <li>Toque no botão <strong>Compartilhar</strong> (ícone do quadrado com seta para cima ⎋)</li>
            <li>Role para baixo e selecione <strong>Adicionar à Tela de Início</strong> ⊞</li>
            <li>Toque em <strong>Adicionar</strong> no canto superior direito</li>
          </ol>
        </div>
      )}
    </div>
  );
};
