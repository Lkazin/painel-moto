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
  CheckCircle,
  AlertCircle,
  Wallet
} from 'lucide-react';

import {
  DriverAccount,
  DriverSession,
  DriverPresence,
  Offer,
  Assignment
} from './types';

import { api } from './services/api';
import { offlineQueue } from './services/offlineQueue';
import { audioAlert } from './utils/audioAlert';

import { ScreenAuthDriver } from './components/ScreenAuthDriver';
import { ScreenStoreConnect } from './components/ScreenStoreConnect';
import { ScreenProfileLedger } from './components/ScreenProfileLedger';
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
  // Autenticação Pessoal do Entregador e Sessão de Plantão na Loja
  const [account, setAccount] = useState<DriverAccount | null>(api.getDriverAccount());
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
  const [historySummary, setHistorySummary] = useState({ totalEarnings: 0, itemsCount: 0 });

  // Modais de Apoio
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isProfileLedgerOpen, setIsProfileLedgerOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<{ assignment: Assignment; isException: boolean } | null>(null);
  const [isRouteCompletedOpen, setIsRouteCompletedOpen] = useState(false);
  const [routeCompletedStats, setRouteCompletedStats] = useState({ count: 0, fees: 0, hasUninformed: false });

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

  // Monitora conectividade e fila offline real
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe((queue) => {
      setIsOnline(offlineQueue.getIsOnline());
      setPendingSyncCount(queue.filter((q) => q.status === 'pending' || q.status === 'syncing').length);
    });
    return () => unsubscribe();
  }, []);

  // Carrega atribuições e histórico real da API
  const refreshAssignments = useCallback(async () => {
    if (!session) return;
    try {
      const [data, hist] = await Promise.all([
        api.getAssignments(),
        api.getHistory()
      ]);
      setAssignments(data);
      setHistorySummary({
        totalEarnings: hist.totalEarnings,
        itemsCount: hist.items.length
      });
    } catch {}
  }, [session]);

  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments]);

  // Polling em tempo real para verificar novas ofertas disparadas pela loja (a cada 5 segundos)
  useEffect(() => {
    if (!session || !presence.manualEnabled) return;

    const interval = setInterval(async () => {
      try {
        const offers = await api.getOffers();
        if (offers.length > 0 && !currentOffer) {
          setCurrentOffer(offers[0]);
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [session, presence.manualEnabled, currentOffer]);

  // Validação periódica da sessão com o servidor (heartbeat a cada 30 segundos)
  useEffect(() => {
    if (!session) return;

    const heartbeat = setInterval(async () => {
      const res = await api.validateSession();
      if (!res.valid) {
        setSession(null);
        showToast('Sessão de plantão expirada ou encerrada pela loja.', 'error');
      }
    }, 30000);

    return () => clearInterval(heartbeat);
  }, [session, showToast]);

  // Aplica tema CSS no body
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

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
  const handleOfferExpired = (_offerId: string) => {
    setCurrentOffer(null);
    showToast('Tempo limite de 60s esgotado. Oferta devolvida ao lojista.', 'info');
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
  const handleDeliverySuccess = async (_message: string, isOfflinePending?: boolean) => {
    const completedAssignment = pinTarget || activeDelivery;
    setPinTarget(null);
    setActiveDelivery(null);

    const remainingInRoute = assignments.filter(
      (a) =>
        (a.status === 'picked_up' || a.status === 'in_transit') &&
        a.assignmentId !== completedAssignment?.assignmentId
    );

    await refreshAssignments();

    if (isOfflinePending) {
      showToast('Entrega gravada no aparelho! Pendente de validação online com a loja.', 'info');
    } else {
      showToast('Entrega validada com sucesso pelo servidor da loja!', 'success');
    }

    // Se concluiu a última entrega da rota, abre a tela de Resumo de Rota
    if (remainingInRoute.length === 0) {
      setRouteCompletedStats({
        count: 1,
        fees: completedAssignment?.deliveryFee || 0,
        hasUninformed: completedAssignment?.deliveryFee === null
      });
      setIsRouteCompletedOpen(true);
    } else {
      setActiveTab('route');
    }
  };

  // Encerrar Plantão nesta loja e salvar ganhos no extrato
  const handleCloseStoreShift = async () => {
    try {
      const res = await api.closeStoreShift();
      setSession(null);
      setIsStoreModalOpen(false);
      setIsProfileLedgerOpen(false);
      showToast(
        `Plantão encerrado em ${res.shiftSummary.storeName}. Total a receber: R$ ${res.shiftSummary.totalToReceive.toFixed(2).replace('.', ',')}`,
        'success'
      );
    } catch (e: any) {
      showToast(e.message || 'Erro ao encerrar plantão.', 'error');
    }
  };

  // Logout seguro da conta do entregador
  const handleLogoutAccount = () => {
    api.logoutDriver();
    setAccount(null);
    setSession(null);
    setIsStoreModalOpen(false);
    setIsProfileLedgerOpen(false);
    showToast('Você saiu da sua conta de entregador com segurança.', 'info');
  };

  // Pedidos no balcão e na rota para os badges do bottom nav
  const waitingPickupCount = assignments.filter((a) => a.status === 'waiting_pickup').length;
  const activeDeliveries = assignments.filter((a) => a.status === 'picked_up' || a.status === 'in_transit');

  // FLUXO 1: Entregador NÃO está logado na sua conta pessoal -> Tela de Login / Cadastro
  if (!account) {
    return (
      <div className="app-container">
        <ScreenAuthDriver
          onLoginSuccess={(newAccount) => {
            setAccount(newAccount);
            showToast(`Bem-vindo(a), ${newAccount.name}!`, 'success');
          }}
        />

        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              background: toastMessage.type === 'error' ? 'var(--nw-red)' : toastMessage.type === 'success' ? 'var(--nw-emerald)' : 'var(--bg-card)',
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

  // FLUXO 2: Entregador está logado, mas NÃO tem plantão ativo na loja -> Tela de Conectar à Loja & Extrato
  if (!session) {
    return (
      <div className="app-container">
        <ScreenStoreConnect
          account={account}
          onShiftStarted={(newSession) => {
            setSession(newSession);
            setPresence(api.getPresence());
            refreshAssignments();
            showToast(`Plantão iniciado na ${newSession.storeName}!`, 'success');
          }}
          onLogoutAccount={handleLogoutAccount}
          onOpenLedgerModal={() => setIsProfileLedgerOpen(true)}
        />

        {/* Modal de Extrato Completo e Perfil */}
        {isProfileLedgerOpen && (
          <ScreenProfileLedger
            account={account}
            activeSession={session}
            onClose={() => setIsProfileLedgerOpen(false)}
            onCloseShift={handleCloseStoreShift}
            onLogoutAccount={handleLogoutAccount}
          />
        )}

        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              top: '20px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 200,
              background: toastMessage.type === 'error' ? 'var(--nw-red)' : toastMessage.type === 'success' ? 'var(--nw-emerald)' : 'var(--bg-card)',
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

  // FLUXO 3: Entregador logado com Plantão Ativo na Loja -> Dashboard operacional de entregas
  return (
    <div className="app-container">
      {/* Top Header Fixo */}
      <header className="top-header">
        <div className="top-header-row">
          {/* Brand Universal */}
          <div className="brand-pill">
            <span className="logo-dot" />
            <span>NovaesWeb</span>
            <span style={{ color: 'var(--nw-pink)', fontSize: '13px', fontWeight: 900 }}>ENTREGADOR</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Botão de Extrato Rápido */}
            <button
              onClick={() => {
                audioAlert.playClickSound();
                setIsProfileLedgerOpen(true);
              }}
              style={{
                background: 'rgba(16, 185, 129, 0.15)',
                border: '1px solid rgba(16, 185, 129, 0.4)',
                color: 'var(--nw-emerald)',
                padding: '6px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: 900,
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                cursor: 'pointer'
              }}
              title="Ver meu extrato e perfil"
            >
              <Wallet size={14} />
              <span>Extrato</span>
            </button>

            {/* Store Context Pill: Nome da loja ativa */}
            <button
              onClick={() => {
                audioAlert.playClickSound();
                setIsStoreModalOpen(true);
              }}
              className="store-context-pill"
              title="Ver detalhes da loja ativa e configurações"
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

        {/* Banner de Conexão Offline Real */}
        {!isOnline && (
          <div className="offline-banner">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <WifiOff size={16} />
              <span>Sem Conexão com a Internet</span>
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
                completedTodayCount={historySummary.itemsCount}
                earningsEstimated={historySummary.totalEarnings}
                onTogglePresence={handleTogglePresence}
                onNavigateToRoute={() => setActiveTab('route')}
                onNavigateToOrders={() => setActiveTab('orders')}
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

      {/* Modal 4.11: Resumo de Fim de Rota */}
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

      {/* Modal de Configuração & Loja Ativa */}
      {isStoreModalOpen && (
        <ModalSessionAndStore
          session={session}
          onClose={() => setIsStoreModalOpen(false)}
          onLogout={handleLogoutAccount}
          onCloseShift={handleCloseStoreShift}
          onToggleTheme={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          currentTheme={theme}
        />
      )}

      {/* Modal de Perfil & Extrato por Loja */}
      {isProfileLedgerOpen && (
        <ScreenProfileLedger
          account={account}
          activeSession={session}
          onClose={() => setIsProfileLedgerOpen(false)}
          onCloseShift={handleCloseStoreShift}
          onLogoutAccount={handleLogoutAccount}
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
