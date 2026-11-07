import { Capacitor } from '@capacitor/core';
import React, { useState, useEffect, useRef } from 'react';
import { BatteryCharging, Power, Navigation, Package, TrendingUp, AlertCircle, ArrowRight, Info, Smartphone, BellRing, MapPin, CheckCircle2 } from 'lucide-react';
import { DriverSession, DriverPresence, Assignment, TrackingSessionState } from '../types';
import { audioAlert } from '../utils/audioAlert';
import { requestNotificationPermission, getNotificationPermission } from '../utils/mobileWake';
import { trackingService } from '../services/trackingService';
import { pushService } from '../services/pushService';
import './DashboardExperience.css';

interface ScreenDashboardProps {
  session: DriverSession;
  presence: DriverPresence;
  assignments: Assignment[];
  completedTodayCount: number;
  earningsEstimated: number;
  onTogglePresence: () => void | Promise<void>;
  onNavigateToRoute: () => void;
  onNavigateToOrders: () => void;
}

// A leitura assistiva recebe o valor real; somente a representação visual anima.
function AnimatedMetric({ value, money = false }: { value: number; money?: boolean }) {
  const safeValue = Number.isFinite(value) ? value : 0;
  const [display, setDisplay] = useState(safeValue);
  const previous = useRef(safeValue);
  const format = (number: number) => money
    ? number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    : Math.round(number).toLocaleString('pt-BR');
  useEffect(() => {
    const startValue = previous.current;
    previous.current = safeValue;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const reduced = () => media.matches || document.documentElement.dataset.reducedMotion === 'true';
    if (startValue === safeValue || reduced() || typeof requestAnimationFrame === 'undefined') { setDisplay(safeValue); return; }
    let frame = 0;
    let started: number | null = null;
    const stop = () => { cancelAnimationFrame(frame); setDisplay(safeValue); };
    const animate = (time: number) => {
      if (reduced()) { stop(); return; }
      if (started === null) started = time;
      const progress = Math.min(1, (time - started) / 450);
      setDisplay(startValue + (safeValue - startValue) * (1 - Math.pow(1 - progress, 3)));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };
    media.addEventListener?.('change', stop);
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); media.removeEventListener?.('change', stop); };
  }, [safeValue]);
  return <span className="nw-dashboard-number"><span className="nw-dashboard-sr-only">{Number.isFinite(value) ? format(safeValue) : 'Não informado'}</span><span aria-hidden="true">{Number.isFinite(value) ? format(display) : '—'}</span></span>;
}

export const ScreenDashboard: React.FC<ScreenDashboardProps> = ({ session, presence, assignments, completedTodayCount, earningsEstimated, onTogglePresence, onNavigateToRoute, onNavigateToOrders }) => {
  const [toggleLoading, setToggleLoading] = useState(false);
  const [presenceError, setPresenceError] = useState('');
  const activeDeliveries = assignments.filter(a => a.status === 'picked_up' || a.status === 'in_transit').sort((a, b) => (a.sequence || 0) - (b.sequence || 0));
  const waitingPickup = assignments.filter(a => a.status === 'waiting_pickup');
  const nextStop = activeDeliveries[0];
  const isAvailable = presence.manualEnabled && presence.isOnline;
  const handlePresenceClick = async () => {
    if (toggleLoading) return;
    setToggleLoading(true); setPresenceError(''); audioAlert.playClickSound();
    try { await onTogglePresence(); }
    catch (error) { setPresenceError(error instanceof Error ? error.message : 'Não foi possível alterar sua disponibilidade. Tente novamente.'); }
    finally { setToggleLoading(false); }
  };
  const context = nextStop ? {
    state: 'route', label: 'Sua próxima parada', title: `Pedido #${nextStop.orderNumber}`,
    description: `${nextStop.customerName} • ${[nextStop.address, nextStop.addressNumber, nextStop.neighborhood].filter(Boolean).join(', ')}`,
    action: 'Continuar minha rota', onAction: onNavigateToRoute,
  } : waitingPickup.length ? {
    state: 'pickup', label: 'Próximo passo', title: 'Hora de conferir a retirada',
    description: `${waitingPickup.length} ${waitingPickup.length === 1 ? 'pedido aguarda' : 'pedidos aguardam'} sua conferência na loja.`,
    action: 'Conferir pedidos', onAction: onNavigateToOrders,
  } : !presence.isOnline ? {
    state: 'offline', label: 'Conexão interrompida', title: 'Vamos reconectar?',
    description: 'Confira o Wi-Fi ou os dados móveis. A disponibilidade depende da conexão com a loja.',
    action: 'Consultar meus pedidos', onAction: onNavigateToOrders,
  } : isAvailable ? {
    state: 'available', label: 'Tudo pronto para começar', title: 'Aguardando a próxima corrida',
    description: `Você está disponível para receber novas ofertas de ${session.storeName}.`,
    action: 'Ver meus pedidos', onAction: onNavigateToOrders,
  } : {
    state: 'paused', label: 'Seu momento de pausa', title: 'Pronto para voltar?',
    description: 'Ative sua disponibilidade quando estiver pronto para receber novas ofertas.',
    action: 'Ficar disponível', onAction: () => void handlePresenceClick(),
  };

  return <div className="nw-dashboard">
    <section className={`nw-dashboard-next nw-dashboard-next--${context.state}`} aria-labelledby="nw-next-action-title">
      <div className="nw-dashboard-eyebrow"><span className="nw-dashboard-status-dot" aria-hidden="true" />{context.label}</div>
      <div className="nw-dashboard-next-heading"><h2 id="nw-next-action-title">{context.title}</h2><span className="nw-dashboard-next-icon" aria-hidden="true">{nextStop ? <Navigation size={26} /> : waitingPickup.length ? <Package size={26} /> : <Power size={26} />}</span></div>
      <p>{context.description}</p>
      <button type="button" className="btn-glove nw-dashboard-primary" onClick={context.onAction} disabled={context.state === 'paused' && toggleLoading}>
        <span>{context.state === 'paused' && toggleLoading ? 'Conectando…' : context.action}</span><ArrowRight size={20} aria-hidden="true" />
      </button>
      {activeDeliveries.length > 0 && <div className="nw-dashboard-context-foot">{activeDeliveries.length} {activeDeliveries.length === 1 ? 'parada na sua rota' : 'paradas na sua rota'}{waitingPickup.length > 0 && ` · ${waitingPickup.length} para retirar`}</div>}
    </section>

    <section className="nw-dashboard-metrics" aria-label="Resumo da loja conectada">
      <div className="nw-dashboard-metric"><span className="nw-dashboard-metric-label"><Package size={17} aria-hidden="true" />Entregas concluídas</span><AnimatedMetric value={completedTodayCount} /><small>No histórico carregado</small></div>
      <div className="nw-dashboard-metric nw-dashboard-metric--earnings"><span className="nw-dashboard-metric-label"><TrendingUp size={17} aria-hidden="true" />Ganhos informados</span><AnimatedMetric value={earningsEstimated} money /><small>Valores informados pela loja</small></div>
    </section>

    <section className="card-surface nw-dashboard-presence" aria-label="Disponibilidade para novas ofertas">
      <div><span className="nw-dashboard-eyebrow">Novas ofertas</span><strong>{!presence.isOnline ? 'Sem conexão' : isAvailable ? 'Você está disponível' : 'Disponibilidade pausada'}</strong><small>{session.storeName}</small></div>
      <button type="button" onClick={() => void handlePresenceClick()} disabled={toggleLoading || !presence.isOnline} aria-pressed={presence.manualEnabled} className={`nw-dashboard-presence-button ${isAvailable ? 'is-on' : ''}`}>
        <Power size={21} aria-hidden="true" /><span>{toggleLoading ? 'Aguarde…' : presence.manualEnabled ? 'Pausar' : 'Ativar'}</span>
      </button>
      {presenceError && <p role="alert" className="nw-dashboard-error">{presenceError}</p>}
      {!presence.isOnline && <p className="nw-dashboard-offline"><AlertCircle size={16} aria-hidden="true" />Reconecte o aparelho para alterar sua disponibilidade.</p>}
    </section>

    {nextStop && waitingPickup.length > 0 && <button type="button" className="nw-dashboard-pickup-link" onClick={onNavigateToOrders}><Package size={20} aria-hidden="true" /><span><strong>{waitingPickup.length} {waitingPickup.length === 1 ? 'pedido para retirar' : 'pedidos para retirar'}</strong><small>Conferir os pedidos na loja</small></span><ArrowRight size={18} aria-hidden="true" /></button>}

    {!nextStop && waitingPickup.length === 0 && <section className="nw-dashboard-empty" aria-label="Nenhuma entrega em andamento"><span className="nw-dashboard-empty-icon" aria-hidden="true"><Package size={24} /></span><div><h3>Nenhuma entrega em andamento</h3><p>{!presence.isOnline ? 'Os dados podem estar desatualizados enquanto o aparelho está sem conexão.' : isAvailable ? 'Quando uma oferta chegar, ela aparecerá aqui. Confira abaixo se os avisos e o GPS estão permitidos.' : 'Seus pedidos continuam acessíveis durante a pausa. Ative a disponibilidade acima para receber novas ofertas.'}</p></div><button type="button" onClick={onNavigateToOrders}>Consultar pedidos<ArrowRight size={16} aria-hidden="true" /></button></section>}

    <div className="nw-dashboard-support"><DriverPermissionsCard driverId={session.driverId} hasActiveRoute={activeDeliveries.length > 0} isAvailable={isAvailable} /><AndroidBatteryOptimizationCard /></div>
    {!Capacitor.isNativePlatform() && <PwaInstallCard />}
    <div className="nw-dashboard-disclaimer"><Info size={16} aria-hidden="true" /><span>O total soma apenas valores informados pelo lojista no despacho e não comprova pagamento formal.</span></div>
  </div>;
};
// Card Duplo de Permissões: 1. Notificações (Tela Bloqueada) + 2. Localização Real (GPS)
const DriverPermissionsCard: React.FC<{ driverId: string; hasActiveRoute: boolean; isAvailable?: boolean }> = ({ driverId, hasActiveRoute, isAvailable }) => {
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
        {/* Alerta quando disponível com recursos essenciais desligados */}
      {isAvailable && (!isNotifOk || !isGpsOk) && (
        <div
          role="alert"
          style={{
            background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(245, 158, 11, 0.15))',
            border: '2px solid var(--nw-amber)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nw-amber)' }}>
            <AlertCircle size={20} />
            <strong style={{ fontSize: '13px', color: '#ffffff' }}>
              Você está DISPONÍVEL com recursos essenciais desativados!
            </strong>
          </div>
          <p style={{ fontSize: '12px', color: '#fde68a', margin: 0, lineHeight: 1.4 }}>
            {!isNotifOk && !isGpsOk
              ? 'GPS e Notificações estão inativos. Ative ambos abaixo para não perder ofertas de corridas.'
              : !isNotifOk
              ? 'Notificações estão inativas. O aparelho não tocará ofertas com a tela bloqueada.'
              : 'GPS em tempo real inativo. A loja não consegue visualizar sua moto no mapa.'}
          </p>
        </div>
      )}

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
                ? 'Permissão concedida • Confira o som e as restrições do aparelho'
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
                ? `Última posição obtida${Number.isFinite(trackingState.lastLocation.accuracy) ? ` (±${Math.round(trackingState.lastLocation.accuracy!)}m)` : ''}${trackingState.isActive ? ' • Rastreamento ativo' : ' • Sem compartilhamento ativo'}`
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

// Componente de Otimização de Bateria e Segundo Plano Android
const AndroidBatteryOptimizationCard: React.FC = () => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div
      className="card-surface"
      style={{
        padding: '14px 16px',
        borderRadius: '16px',
        border: '1px solid var(--border-subtle)',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.06) 0%, var(--bg-card) 100%)'
      }}
    >
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="nw-dashboard-battery-tip"
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          cursor: 'pointer',
          width: '100%',
          border: 0,
          background: 'transparent',
          textAlign: 'left',
          font: 'inherit',
          padding: 0
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(245, 158, 11, 0.2)',
              color: 'var(--nw-amber)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <BatteryCharging size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '13px', fontWeight: 800, color: '#ffffff', margin: 0 }}>
              Bateria e Segundo Plano (Android)
            </h4>
            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Dica para o app não fechar com a tela apagada
            </p>
          </div>
        </div>

        <span style={{ fontSize: '12px', color: 'var(--nw-pink)', fontWeight: 800 }}>
          {isOpen ? 'Ocultar' : 'Ver Dica'}
        </span>
      </button>

      {isOpen && (
        <div
          id="nw-dashboard-battery-tip"
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid var(--border-subtle)',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            lineHeight: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <p style={{ margin: 0, color: '#ffffff', fontWeight: 700 }}>
            Para receber ofertas e manter o GPS ativo no suporte sem cortes do Android:
          </p>
          <ol style={{ margin: 0, paddingLeft: '18px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <li>Abra as <strong>Configurações</strong> do aparelho.</li>
            <li>Vá em <strong>Aplicativos</strong> → <strong>NovaesWeb Entregador</strong>.</li>
            <li>Toque em <strong>Bateria</strong> e escolha <strong>"Sem restrições"</strong> (ou desative a economia).</li>
            <li>Em celulares Xiaomi/Redmi: ative também o <strong>Início Automático</strong>.</li>
          </ol>
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              borderRadius: '10px',
              padding: '8px 10px',
              color: 'var(--nw-emerald)',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            Essas opções ajudam a manter o app ativo. O comportamento depende das permissões e das restrições do aparelho.
          </div>
        </div>
      )}
    </div>
  );
};
