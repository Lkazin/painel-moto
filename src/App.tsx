import React, { useState, useEffect, useCallback } from 'react';
import {
  Home,
  Package,
  Navigation,
  History,
  Store,
  Wifi,
  WifiOff,
  Settings,
  Bell,
  CheckCircle,
  AlertCircle
} from 'lucide-react';

import {
  DriverSession,
  DriverPresence,
  Offer,
  Assignment,
  RouteStop
} from './types';

import { api } from './services/api';
import { offlineQueue } from './services/offlineQueue';
import { audioAlert } from './utils/audioAlert';

import { ScreenActivation } from './components/ScreenActivation';
import { ScreenDashboard } from './components/ScreenDashboard';
import { ModalOfferReceived } from './components/ModalOfferReceived';
import { ScreenOrdersPickup } from './components/ScreenOrdersPickup';
import { ScreenRoute } from './components/ScreenRoute';
import { ScreenActiveDelivery } from './components/ScreenActiveDelivery';
import { ScreenPinConfirm } from './components/ScreenPinConfirm';
import { ScreenHistory } from './components/ScreenHistory';
import { ModalSessionAndStore } from './components/ModalSessionAndStore';
import { ModalWithdrawal } from './components/ModalWithdrawal';
import { ModalRouteCompleted } from './components/ModalRouteCompleted';

export const App: React.FC = () => {
  // Estados de Sessão e Configuração
  const [session, setSession] = useState<DriverSession | null>(api.getSession());
  const [presence, setPresence] = useState<DriverPresence>(api.getPresence());
  const [isOnline, setIsOnline] = useState<boolean>(offlineQueue.getIsOnline());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Estados de Navegação
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'route' | 'history'>('dashboard');
  const [activeDelivery, setActiveDelivery] = useState<Assignment | null>(null);
  const [pinTarget, setPinTarget] = useState<Assignment | null>(null);

  // Estados de Dados
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(offlineQueue.getPendingCount());

  // Modais de Apoio
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<{ assignment: Assignment; isException: boolean } | null>(null);
  const [isRouteCompletedOpen, setIsRouteCompletedOpen] = useState(false);
  const [routeCompletedStats, setRouteCompletedStats] = useState({ count: 2, fees: 26.5, hasUninformed: false });

  // Toast de Notificação
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  }, []);

  // Inicializa áudio no primeiro clique do usuário
  useEffect(() => {
    const handleFirstInteraction = () => {
      audioAlert.init();
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
    window.addEventListener('click', handleFirstInteraction);
    window.addEventListener('touchstart', handleFirstInteraction);
    return () => {
      window.removeEventListener('click', handleFirstInteraction);
      window.removeEventListener('touchstart', handleFirstInteraction);
    };
  }, []);

  // Monitora conectividade e fila offline
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queue) => {
      setIsOnline(offlineQueue.getIsOnline());
      setPendingSyncCount(queue.filter((q) => q.status === 'pending' || q.status === 'syncing').length);
    });
    return () => unsubscribe();
  }, []);

  // Carrega atribuições e ofertas da API
  const refreshAssignments = useCallback(async () => {
    if (!session) return;
    try {
      const data = await api.getAssignments();
      setAssignments(data);
    } catch {}
  }, [session]);

  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments]);

  // Polling leve para verificar ofertas e presença a cada 8 segundos
  useEffect(() => {
    if (!session || !presence.manualEnabled) return;

    const interval = setInterval(async () => {
      try {
        const offers = await api.getOffers();
        if (offers.length > 0 && !currentOffer) {
          setCurrentOffer(offers[0]);
        }
      } catch {}
    }, 8000);

    return () => clearInterval(interval);
  }, [session, presence.manualEnabled, currentOffer]);

  // Aplica tema CSS no body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Handler de Ativação
  const handleActivated = (newSession: DriverSession) => {
    setSession(newSession);
    setPresence(api.getPresence());
    refreshAssignments();
    showToast(`Bem-vindo, ${newSession.driverName}! Vínculo com ${newSession.storeName} ativado.`, 'success');
  };

  // Handler de Ligado/Desligado
  const handleTogglePresence = async () => {
    const newStatus = !presence.manualEnabled;
    const updated = await api.setPresence(newStatus);
    setPresence(updated);
    if (newStatus) {
      showToast('Você está LIGADO e disponível para receber novas corridas.', 'success');
    } else {
      showToast('Você está DESLIGADO. Conclua os pedidos em andamento sem receber novas ofertas.', 'info');
    }
  };

  // Aceitar Oferta
  const handleAcceptOffer = async (offerId: string) => {
    try {
      await api.respondOffer(offerId, 'accepted');
      setCurrentOffer(null);
      await refreshAssignments();
      showToast('Corrida aceita! O pedido está aguardando retirada no balcão da pizzaria.', 'success');
      setActiveTab('orders');
    } catch (err: any) {
      setCurrentOffer(null);
      showToast(err.message || 'Erro ao aceitar oferta.', 'error');
    }
  };

  // Recusar Oferta
  const handleRejectOffer = async (offerId: string) => {
    try {
      await api.respondOffer(offerId, 'rejected');
      setCurrentOffer(null);
      showToast('Oferta recusada e devolvida ao despacho da loja.', 'info');
    } catch {
      setCurrentOffer(null);
    }
  };

  // Oferta Expirada pelos 60s
  const handleOfferExpired = (offerId: string) => {
    setCurrentOffer(null);
    showToast('Tempo limite de 60s esgotado. Oferta devolvida ao lojista.', 'info');
  };

  // Disparo manual de oferta de teste para homologação
  const handleTriggerSimulatedOffer = () => {
    if (!presence.manualEnabled) {
      showToast('Ligue sua disponibilidade primeiro para poder receber ofertas.', 'info');
      return;
    }
    const offer = api.triggerSimulatedOffer();
    setCurrentOffer(offer);
    showToast('Nova oferta disparada pela Bella Pizza! Teste o áudio e a contagem de 60s.', 'info');
  };

  // Confirmar Retirada de Pedidos
  const handleConfirmPickup = async (assignmentIds: string[]) => {
    const res = await api.confirmPickup(assignmentIds);
    await refreshAssignments();
    showToast(`Retirada confirmada de ${res.confirmed.length} pedido(s)! Adicionados à sua rota.`, 'success');
  };

  // Reordenar Rota
  const handleReorderRoute = async (stops: { assignmentId: string; sequence: number }[]) => {
    await api.reorderRoute(stops);
    await refreshAssignments();
    showToast('Nova sequência da rota salva com sucesso!', 'success');
  };

  // Sucesso na Entrega com PIN
  const handleDeliverySuccess = async (message: string, isOfflinePending?: boolean) => {
    const completedAssignment = pinTarget || activeDelivery;
    setPinTarget(null);
    setActiveDelivery(null);

    // Verifica quantas entregas restam na rota
    const remainingInRoute = assignments.filter(
      (a) =>
        (a.status === 'picked_up' || a.status === 'in_transit') &&
        a.assignmentId !== completedAssignment?.assignmentId
    );

    await refreshAssignments();

    if (isOfflinePending) {
      showToast('Entrega gravada localmente! Pendente de validação online com a loja.', 'info');
    } else {
      showToast('Entrega validada com sucesso pelo servidor da loja!', 'success');
    }

    // Se concluiu a última entrega da rota, abre a tela 4.11 de Resumo de Fim de Rota (AC-27)
    if (remainingInRoute.length === 0) {
      setRouteCompletedStats({
        count: 2,
        fees: 26.5,
        hasUninformed: false
      });
      setIsRouteCompletedOpen(true);
    } else {
      setActiveTab('route');
    }
  };

  // Troca de Loja Vinculada (AC-06)
  const handleSwitchStore = async (storeId: string) => {
    const updated = await api.switchStore(storeId);
    setSession(updated);
    await refreshAssignments();
    showToast(`Vínculo ativo alterado para ${updated.storeName}.`, 'success');
  };

  // Logout seguro
  const handleLogout = () => {
    api.logout();
    setSession(null);
    setIsStoreModalOpen(false);
    showToast('Sessão revogada neste aparelho com segurança.', 'info');
  };

  // Pedidos no balcão e na rota para os badges do bottom nav
  const waitingPickupCount = assignments.filter((a) => a.status === 'waiting_pickup').length;
  const activeDeliveries = assignments.filter((a) => a.status === 'picked_up' || a.status === 'in_transit');

  // Se não estiver ativado, renderiza a Tela 1
  if (!session) {
    return (
      <div className="app-container">
        <ScreenActivation onActivated={handleActivated} />
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              background: toastMessage.type === 'error' ? 'var(--nw-red)' : 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: '16px',
              fontSize: '13px',
              fontWeight: 800,
              boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {toastMessage.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span>{toastMessage.text}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Top Header Fixo */}
      <header className="top-header">
        <div className="top-header-row">
          {/* Brand Universal (Nunca fixo ao nome da loja) */}
          <div className="brand-pill">
            <span className="logo-dot" />
            <span>NovaesWeb</span>
            <span style={{ color: 'var(--nw-pink)', fontSize: '13px', fontWeight: 900 }}>ENTREGADOR</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Store Context Pill: Nome da loja ativa como detalhe contextual */}
            <button
              onClick={() => {
                audioAlert.playClickSound();
                setIsStoreModalOpen(true);
              }}
              className="store-context-pill"
              title="Ver detalhes da loja ativa e conexão"
            >
              <Store size={14} color="#d8b4fe" />
              <span>{session.storeName}</span>
            </button>

            {/* Botão de Menu / Configurações */}
            <button
              onClick={() => {
                audioAlert.playClickSound();
                setIsStoreModalOpen(true);
              }}
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-muted)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
              aria-label="Abrir configurações de conta e loja"
            >
              <Settings size={17} />
            </button>
          </div>
        </div>

        {/* Banner de Modo Sem Internet / Offline */}
        {!isOnline && (
          <div className={`offline-banner ${offlineQueue.getIsSimulated() ? 'offline-banner-simulated' : ''}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <WifiOff size={16} />
              <span>
                {offlineQueue.getIsSimulated() ? 'Simulação Offline Ativa' : 'Sem Conexão com a Internet'}
              </span>
            </div>
            {pendingSyncCount > 0 && (
              <span style={{ fontSize: '11px', background: 'rgba(0,0,0,0.3)', padding: '2px 8px', borderRadius: '10px' }}>
                {pendingSyncCount} {pendingSyncCount === 1 ? 'pendência local' : 'pendências locais'}
              </span>
            )}
          </div>
        )}
      </header>

      {/* Conteúdo Principal conforme Fluxo & Telas */}
      <main style={{ flex: 1, paddingBottom: '20px' }}>
        {/* Tela 7: Confirmação por PIN (Sobreposta à entrega ativa) */}
        {pinTarget ? (
          <ScreenPinConfirm
            assignment={pinTarget}
            onBack={() => setPinTarget(null)}
            onDeliverySuccess={handleDeliverySuccess}
            onRequestException={(asg) => setWithdrawTarget({ assignment: asg, isException: true })}
          />
        ) : activeDelivery ? (
          /* Tela 6: Entrega Ativa */
          <ScreenActiveDelivery
            assignment={activeDelivery}
            onBack={() => setActiveDelivery(null)}
            onOpenPinConfirmation={(asg) => setPinTarget(asg)}
            onRequestWithdraw={(asg) => setWithdrawTarget({ assignment: asg, isException: false })}
          />
        ) : (
          <>
            {/* Tela 2: Início / Dashboard */}
            {activeTab === 'dashboard' && (
              <ScreenDashboard
                session={session}
                presence={presence}
                assignments={assignments}
                onTogglePresence={handleTogglePresence}
                onNavigateToRoute={() => setActiveTab('route')}
                onNavigateToOrders={() => setActiveTab('orders')}
                onTriggerSimulatedOffer={handleTriggerSimulatedOffer}
              />
            )}

            {/* Tela 4: Meus Pedidos & Retirada */}
            {activeTab === 'orders' && (
              <ScreenOrdersPickup
                assignments={assignments}
                onConfirmPickup={handleConfirmPickup}
                onRequestWithdraw={(asg) => setWithdrawTarget({ assignment: asg, isException: false })}
                onNavigateToRoute={() => setActiveTab('route')}
              />
            )}

            {/* Tela 5: Minha Rota */}
            {activeTab === 'route' && (
              <ScreenRoute
                assignments={assignments}
                onReorder={handleReorderRoute}
                onSelectDelivery={(asg) => setActiveDelivery(asg)}
                onNavigateToOrders={() => setActiveTab('orders')}
              />
            )}

            {/* Tela 8: Histórico & Ganhos */}
            {activeTab === 'history' && <ScreenHistory />}
          </>
        )}
      </main>

      {/* Tela 3: Card Flutuante de Oferta Recebida (Alerta de 60s com som) */}
      {currentOffer && (
        <ModalOfferReceived
          offer={currentOffer}
          onAccept={handleAcceptOffer}
          onReject={handleRejectOffer}
          onExpired={handleOfferExpired}
        />
      )}

      {/* Modal 4.11: Resumo de Fim de Rota (Critério AC-25 e AC-27) */}
      {isRouteCompletedOpen && (
        <ModalRouteCompleted
          completedOrdersCount={routeCompletedStats.count}
          totalFeesInformed={routeCompletedStats.fees}
          hasUninformedFees={routeCompletedStats.hasUninformed}
          isAccessExpired={new Date(session.expiresAt).getTime() < Date.now()}
          onReturnToHome={() => {
            setIsRouteCompletedOpen(false);
            setActiveTab('dashboard');
          }}
          onViewHistory={() => {
            setIsRouteCompletedOpen(false);
            setActiveTab('history');
          }}
        />
      )}

      {/* Modal de Configuração & Loja Ativa (Critério AC-06) */}
      {isStoreModalOpen && (
        <ModalSessionAndStore
          session={session}
          onClose={() => setIsStoreModalOpen(false)}
          onLogout={handleLogout}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          onSwitchStore={handleSwitchStore}
          currentTheme={theme}
          pendingDeliveriesCount={waitingPickupCount + activeDeliveries.length}
        />
      )}

      {/* Modal de Solicitação de Desistência / Exceção */}
      {withdrawTarget && (
        <ModalWithdrawal
          assignment={withdrawTarget.assignment}
          isExceptionMode={withdrawTarget.isException}
          onClose={() => setWithdrawTarget(null)}
          onSuccess={(msg) => {
            setWithdrawTarget(null);
            showToast(msg, 'success');
            refreshAssignments();
          }}
        />
      )}

      {/* Toast Notifier Flutuante */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 150,
            background:
              toastMessage.type === 'error'
                ? 'var(--nw-red)'
                : toastMessage.type === 'success'
                ? 'var(--nw-emerald)'
                : 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            color: '#ffffff',
            padding: '12px 18px',
            borderRadius: '16px',
            fontSize: '13px',
            fontWeight: 800,
            boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            maxWidth: '90%',
            animation: 'slide-up 0.2s ease'
          }}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
          ) : (
            <CheckCircle size={18} style={{ flexShrink: 0 }} />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Navegação Inferior Fixa (Polegar / Luva) */}
      <nav className="bottom-nav">
        <button
          onClick={() => {
            audioAlert.playClickSound();
            setActiveDelivery(null);
            setPinTarget(null);
            setActiveTab('dashboard');
          }}
          className={`nav-item ${activeTab === 'dashboard' && !activeDelivery && !pinTarget ? 'active' : ''}`}
        >
          <Home size={22} />
          <span>Início</span>
        </button>

        <button
          onClick={() => {
            audioAlert.playClickSound();
            setActiveDelivery(null);
            setPinTarget(null);
            setActiveTab('orders');
          }}
          className={`nav-item ${activeTab === 'orders' && !activeDelivery && !pinTarget ? 'active' : ''}`}
        >
          <Package size={22} />
          <span>Pedidos</span>
          {waitingPickupCount > 0 && <span className="nav-badge">{waitingPickupCount}</span>}
        </button>

        <button
          onClick={() => {
            audioAlert.playClickSound();
            setActiveDelivery(null);
            setPinTarget(null);
            setActiveTab('route');
          }}
          className={`nav-item ${(activeTab === 'route' || activeDelivery || pinTarget) ? 'active' : ''}`}
        >
          <Navigation size={22} />
          <span>Minha Rota</span>
          {activeDeliveries.length > 0 && <span className="nav-badge">{activeDeliveries.length}</span>}
        </button>

        <button
          onClick={() => {
            audioAlert.playClickSound();
            setActiveDelivery(null);
            setPinTarget(null);
            setActiveTab('history');
          }}
          className={`nav-item ${activeTab === 'history' && !activeDelivery && !pinTarget ? 'active' : ''}`}
        >
          <History size={22} />
          <span>Histórico</span>
        </button>
      </nav>
    </div>
  );
};

export default App;
