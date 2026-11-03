import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect } from 'react';
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
  MapPin,
  CheckCircle2
} from 'lucide-react';
import { DriverSession, DriverPresence, Assignment, TrackingSessionState } from '../types';
import { audioAlert } from '../utils/audioAlert';
import { requestNotificationPermission, getNotificationPermission } from '../utils/mobileWake';
import { trackingService } from '../services/trackingService';
import { pushService } from '../services/pushService';

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
            border: isAvailable ? 'none' : '2px solid rgba(255, 61, 110, 0.4)',
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

      {/* Painel de Permissões Essenciais: Notificações + Localização GPS Real */}
      <DriverPermissionsCard driverId={session.driverId} hasActiveRoute={activeDeliveries.length > 0} />

      {/* Rota Ativa em Andamento (Aparece se houver entregas retiradas) */}
      {activeDeliveries.length > 0 && (
        <div
          className="card-surface card-highlight"
          style={{
            borderLeft: '4px solid var(--nw-pink)',
            background: 'linear-gradient(135deg, rgba(255, 46, 154,0.15), var(--bg-card))'
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

      {/* Banner de Instalação do Aplicativo (PWA) no Celular */}
      {!Capacitor.isNativePlatform() && <PwaInstallCard />}

      {/* Nota Legal Obrigatória (Documento 02 - Seção 13) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '8px',
          background: 'rgba(139, 47, 232, 0.08)',
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

// Card Duplo de Permissões: 1. Notificações (Tela Bloqueada) + 2. Localização Real (GPS)
const DriverPermissionsCard: React.FC<{ driverId: string; hasActiveRoute: boolean }> = ({ driverId, hasActiveRoute }) => {
  const [notifPerm, setNotifPerm] = useState<'granted' | 'denied' | 'default' | 'unsupported'>('default');
  const [trackingState, setTrackingState] = useState<TrackingSessionState>(trackingService.getState());
  const [gpsPermStatus, setGpsPermStatus] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>(
    trackingService.getPermissionStatus()
  );
  const [isRequestingGps, setIsRequestingGps] = useState(false);

  useEffect(() => {
    setNotifPerm(getNotificationPermission());
    let mounted = true;
    if (Capacitor.isNativePlatform()) void pushService.refreshPermission().then(permission => { if (mounted) setNotifPerm(permission); });
    const unsub = trackingService.subscribe((st) => {
      setTrackingState(st);
      setGpsPermStatus(trackingService.getPermissionStatus());
    });
    return () => { mounted = false; unsub(); };
  }, []);

  const handleEnableNotif = async () => {
    audioAlert.playClickSound();
    const granted = Capacitor.isNativePlatform() ? (await pushService.subscribe()).success : await requestNotificationPermission();
    setNotifPerm(granted ? 'granted' : 'denied');
    if (granted) audioAlert.playSuccessSound();
  };

  const handleEnableGps = async () => {
    audioAlert.playClickSound();
    setIsRequestingGps(true);
    const res = await trackingService.requestLocationPermission({ onlyCheckPermission: !hasActiveRoute });
    setIsRequestingGps(false);
    setGpsPermStatus(trackingService.getPermissionStatus());
    if (res.granted) {
      if (hasActiveRoute) {
        trackingService.start(driverId);
      }
      audioAlert.playSuccessSound();
    } else {
      audioAlert.playErrorSound();
    }
  };

  const isNotifOk = notifPerm === 'granted';
  const isGpsOk = gpsPermStatus === 'granted' || Boolean(trackingState.lastLocation);

  return (
    <div
      className="card-surface"
      style={{
        padding: '16px',
        border: isNotifOk && isGpsOk ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid rgba(245, 158, 11, 0.5)',
        background:
          isNotifOk && isGpsOk
            ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, var(--bg-card) 100%)'
            : 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, var(--bg-card) 100%)',
        borderRadius: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '12px', fontWeight: 900, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Permissões do Aparelho (Notificação & GPS)
        </span>
        {isNotifOk && isGpsOk ? (
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--nw-emerald)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <CheckCircle2 size={14} /> Tudo Ativo
          </span>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--nw-amber)' }}>
            Ação Necessária
          </span>
        )}
      </div>

      {/* 1. Permissão de Notificações */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'var(--bg-app)',
          padding: '10px 12px',
          borderRadius: '12px',
          border: isNotifOk ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.3)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: isNotifOk ? 'rgba(16, 185, 129, 0.2)' : '#d97706',
              color: isNotifOk ? 'var(--nw-emerald)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <BellRing size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              1. Notificações de Corrida
            </h4>
            <p style={{ fontSize: '11px', color: isNotifOk ? 'var(--nw-emerald)' : '#fde68a', margin: '2px 0 0 0' }}>
              {isNotifOk
                ? 'Ativado • Toca sirene mesmo com tela bloqueada'
                : 'Toque para permitir avisos de novas entregas'}
            </p>
          </div>
        </div>

        {!isNotifOk ? (
          <button
            onClick={handleEnableNotif}
            style={{
              background: '#d97706',
              color: '#ffffff',
              border: 'none',
              padding: '8px 12px',
              borderRadius: '10px',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              flexShrink: 0
            }}
          >
            Aceitar
          </button>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--nw-emerald)', flexShrink: 0 }}>
            ✓ Permitido
          </span>
        )}
      </div>

      {/* 2. Permissão de Localização GPS Real */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '10px',
          background: 'var(--bg-app)',
          padding: '10px 12px',
          borderRadius: '12px',
          border: isGpsOk ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(255, 46, 154, 0.4)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: isGpsOk ? 'rgba(16, 185, 129, 0.2)' : 'var(--nw-pink)',
              color: isGpsOk ? 'var(--nw-emerald)' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <MapPin size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              2. Localização GPS em Tempo Real
            </h4>
            <p style={{ fontSize: '11px', color: isGpsOk ? 'var(--nw-emerald)' : '#FFB3E0', margin: '2px 0 0 0' }}>
              {trackingState.lastLocation
                ? `GPS Real Ativo (±${Math.round(trackingState.lastLocation.accuracy || 10)}m) • Posição sincronizada`
                : isGpsOk
                ? 'Permissão concedida • Toque para atualizar sua posição'
                : 'Permita o GPS para mostrar sua localização correta no mapa'}
            </p>
          </div>
        </div>

        <button
          onClick={handleEnableGps}
          disabled={isRequestingGps}
          style={{
            background: isGpsOk ? 'rgba(16, 185, 129, 0.2)' : 'var(--nw-pink)',
            color: isGpsOk ? 'var(--nw-emerald)' : '#ffffff',
            border: isGpsOk ? '1px solid rgba(16, 185, 129, 0.4)' : 'none',
            padding: '8px 12px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            flexShrink: 0
          }}
        >
          {isRequestingGps ? 'Buscando GPS...' : isGpsOk ? 'Atualizar GPS' : 'Permitir GPS'}
        </button>
      </div>

      {(notifPerm === 'denied' || trackingState.error) && (
        <p style={{ fontSize: '11px', color: '#fca5a5', margin: 0, lineHeight: 1.4 }}>
          ⚠️ {trackingState.error || 'Se você bloqueou antes, toque no ícone de cadeado ao lado do endereço do site no navegador e marque Localização e Notificações como "Permitir".'}
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
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
      return;
    }

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
        border: '1px solid rgba(255, 46, 154, 0.35)',
        background: 'linear-gradient(135deg, rgba(255, 46, 154, 0.08) 0%, rgba(139, 47, 232, 0.08) 100%)',
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
            boxShadow: '0 4px 14px rgba(255, 46, 154, 0.4)'
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
