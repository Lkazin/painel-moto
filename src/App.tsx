import { Capacitor } from '@capacitor/core';
import { deliveryTrackingDecision } from './services/deliveryTrackingLifecycle';
import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Wallet,
  Smartphone
} from 'lucide-react';

import {
  DriverAccount,
  DriverSession,
  DriverPresence,
  Offer,
  Assignment
} from './types';

import { api } from './services/api';
import { accountClient } from './services/accountClient';
import { offlineQueue } from './services/offlineQueue';
import { trackingService } from './services/trackingService';
import { audioAlert } from './utils/audioAlert';
import { pushService } from './services/pushService';
import { startupSound } from './services/startupSound';
import { publishNotice, clearNotices, removeNotice } from './services/inAppNotices';
import { StartupSplash } from './components/StartupSplash';
import { InAppNotice } from './components/InAppNotice';
import { triggerOfferNotification, requestScreenWakeLock, releaseScreenWakeLock } from './utils/mobileWake';

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
  const [startupAnimationDone, setStartupAnimationDone] = useState(false);
  useEffect(() => {
    const stopSound = startupSound.play();
    const timer = setTimeout(() => { stopSound(); setStartupAnimationDone(true); }, 3000);
    return () => { clearTimeout(timer); stopSound(); };
  }, []);
  // Autenticação Pessoal do Entregador e Sessão de Plantão na Loja
  const [accountReady, setAccountReady] = useState(false);
  const [authHydrated, setAuthHydrated] = useState(!Capacitor.isNativePlatform());
  const [biometricLocked, setBiometricLocked] = useState(false);
  const [unlockError, setUnlockError] = useState('');
  const backgroundAt = useRef<number | null>(null);
  const hasActiveDeliveryRef = useRef(false);
  const [accountNotice, setAccountNotice] = useState(accountClient.getNotice());
  const [syncError, setSyncError] = useState('');
  const [account, setAccount] = useState<DriverAccount | null>(api.getDriverAccount());
  const [session, setSession] = useState<DriverSession | null>(api.getSession());
  const [presence, setPresence] = useState<DriverPresence>(api.getPresence());
  const [isOnline, setIsOnline] = useState<boolean>(offlineQueue.getIsOnline());
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');

  // Restaura a sessão Android somente a partir do Keystore.
  // A opção biométrica não abre uma autenticação sem toque explícito do entregador.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let alive = true;
    void (async () => {
      try {
        const result = await accountClient.restore();
        if (result !== 'locked') await offlineQueue.initialize();
        if (!alive) return;
        setAccount(accountClient.getAccount());
        setBiometricLocked(result === 'locked');
      } catch {
        if (alive) setAccountNotice('Entre com sua senha para restaurar seu acesso.');
      } finally { if (alive) setAuthHydrated(true); }
    })();
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') { backgroundAt.current = Date.now(); return; }
      const elapsed = backgroundAt.current === null ? 0 : Date.now() - backgroundAt.current;
      backgroundAt.current = null;
      // Não interromper GPS, retirada nem confirmação de entrega durante serviço ativo.
      if (trackingService.getState().isActive ||
        hasActiveDeliveryRef.current) return;
      if (elapsed < 5 * 60_000 || biometricLocked || !accountClient.getAccount()) return;
      void accountClient.lockWithBiometrics().then(locked => {
        if (locked) { setBiometricLocked(true); setAccountReady(false); setUnlockError(''); }
      }).catch(() => { /* Não encerra entregas por erro do sensor. */ });
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [biometricLocked]);

  async function unlockBiometric() {
    setUnlockError('');
    try {
      const restored = await accountClient.unlockWithBiometrics();
      await offlineQueue.initialize();
      setAccount(restored);
      setBiometricLocked(false);
      setAccountReady(false);
      void syncAccount();
    } catch {
      setUnlockError('Não foi possível confirmar sua digital ou rosto. Tente novamente ou entre com a senha.');
    }
  }

  // Estados de Navegação
  const [activeTab, setActiveTab] = useState<'dashboard' | 'orders' | 'route' | 'history'>('dashboard');
  const [activeDelivery, setActiveDelivery] = useState<Assignment | null>(null);
  const [pinTarget, setPinTarget] = useState<Assignment | null>(null);

  // Estados de Dados
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  hasActiveDeliveryRef.current = assignments.some(item => ['waiting_pickup', 'picked_up', 'in_transit'].includes(item.status));
  const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
  const handledOfferIdsRef = useRef<Set<string>>(new Set());
  const noticedOfferIdsRef = useRef<Set<string>>(new Set());
  const noticeSequence = useRef(0);
  const noticeAssignmentStates = useRef<Map<string, string>>(new Map());
  const assignmentsRevision = useRef(0);
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(offlineQueue.getPendingCount());
  const [historySummary, setHistorySummary] = useState({ totalEarnings: 0, itemsCount: 0 });

  // Modais de Apoio
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isProfileLedgerOpen, setIsProfileLedgerOpen] = useState(false);
  const [withdrawTarget, setWithdrawTarget] = useState<{ assignment: Assignment; isException: boolean } | null>(null);
  const [isRouteCompletedOpen, setIsRouteCompletedOpen] = useState(false);
  const [routeCompletedStats, setRouteCompletedStats] = useState({ count: 0, fees: 0, hasUninformed: false });

  // Toast de Notificação
  const showToast = useCallback((text: string, type: 'success' | 'error' | 'info' = 'info') => {
    publishNotice({ id: `message:${++noticeSequence.current}`, kind: type, title: type === 'error' ? 'Atenção' : type === 'success' ? 'Tudo certo' : 'NovaesWeb Entregador', message: text });
  }, []);

  useEffect(() => {
    for (const id of noticedOfferIdsRef.current) removeNotice(`offer:${id}`);
    noticedOfferIdsRef.current.clear();
    noticeAssignmentStates.current.clear();
  }, [account?.id, session?.membershipId]);

  const syncAccount = useCallback(async () => {
    if (!api.hasAccountAccess()) return;
    try {
      const result = await api.synchronizeAccount();
      setAccount(result.account); setSession(result.session); setPresence(api.getPresence());
      setAccountReady(true); setSyncError('');
      if (result.session) await api.flushOfflineQueue();
    } catch (error) {
      if ((error as {status?: number})?.status === 401 && api.hasAccountAccess()) {
        accountClient.clear('Sua sessão expirou. Entre novamente para continuar.');
        setAccount(null); setSession(null); setAccountReady(false);
        return;
      }
      if (api.hasAccountAccess()) setSyncError('Não foi possível sincronizar sua conta. Verifique a internet e tente novamente.');
    }
  }, []);

  useEffect(() => {
    const changed = (event: Event) => {
      const message = (event as CustomEvent).detail?.message || '';
      trackingService.stop(false); audioAlert.stopOfferAlert();
      clearNotices(); noticedOfferIdsRef.current.clear();
      setAccount(api.getDriverAccount()); setSession(null); setAccountReady(false);
      setAssignments([]); setCurrentOffer(null); setActiveDelivery(null); setPinTarget(null);
      setIsStoreModalOpen(false); setIsProfileLedgerOpen(false); setWithdrawTarget(null);
      setHistorySummary({totalEarnings:0,itemsCount:0}); handledOfferIdsRef.current.clear();
      setAccountNotice(message); setSyncError('');
    };
    window.addEventListener('novaesweb:account-change',changed);
    const storage = (event: StorageEvent) => {
      if (event.key === 'novaesweb_account_access_v1') {
        // Outra aba mudou a identidade: recarregar evita misturar dados entre contas.
        trackingService.stop(false); window.location.reload();
      }
    };
    window.addEventListener('storage',storage);
    return () => {window.removeEventListener('novaesweb:account-change',changed);window.removeEventListener('storage',storage);};
  }, []);

  useEffect(() => {
    if (!account) return;
    let running = false;
    const check = async () => { if (running || !navigator.onLine) return; running = true; try {await syncAccount();} finally {running=false;} };
    void check();
    const interval = setInterval(check,10000);
    window.addEventListener('focus',check); window.addEventListener('online',check);
    return () => {clearInterval(interval);window.removeEventListener('focus',check);window.removeEventListener('online',check);};
  }, [account?.id,syncAccount]);

  useEffect(() => {
    void pushService.initializeNative();
    const opened = () => {
      if (!accountClient.getToken()) return;
      setActiveTab('orders'); setActiveDelivery(null); setPinTarget(null);
      setIsProfileLedgerOpen(false); setIsStoreModalOpen(false);
      window.dispatchEvent(new Event('focus'));
    };
    const received = (event: Event) => {
      if (!accountClient.getToken()) return;
      const detail = (event as CustomEvent).detail || {};
      // Offer details come from the authenticated poll, not the push payload.
      if (detail.type !== 'NEW_OFFER') showToast([detail.title, detail.body].filter(Boolean).join(' — ') || 'Você recebeu uma nova notificação.', 'info');
      window.dispatchEvent(new Event('focus'));
    };
    const refresh = () => { void pushService.initializeNative(); };
    window.addEventListener('novaesweb:push-open', opened);
    window.addEventListener('novaesweb:push-received', received);
    window.addEventListener('online', refresh);
    return () => {
      window.removeEventListener('novaesweb:push-open', opened);
      window.removeEventListener('novaesweb:push-received', received);
      window.removeEventListener('online', refresh);
    };
  }, [account?.id, showToast]);

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
    const requestRevision = ++assignmentsRevision.current;
    try {
      const [data, hist] = await Promise.all([
        api.getAssignments(),
        api.getHistory().catch(() => null)
      ]);
      if (requestRevision !== assignmentsRevision.current || !api.getSession() ||
        api.getSession()?.driverId !== session.driverId || api.getSession()?.membershipId !== session.membershipId) return;
      for (const item of data) {
        const id = item.assignmentId || item.id || '';
        if (item.status === 'canceled_by_store' && noticeAssignmentStates.current.has(id) && noticeAssignmentStates.current.get(id) !== 'canceled_by_store') {
          publishNotice({ id: `assignment:${id}:canceled`, kind: 'error', title: 'Entrega cancelada', message: `A loja cancelou o pedido ${item.orderNumber || ''}. Confira suas entregas.`, onOpen: () => { setActiveTab('orders'); setActiveDelivery(null); setPinTarget(null); } });
        }
        noticeAssignmentStates.current.set(id, item.status);
      }
      setAssignments(data);
      if (hist) setHistorySummary({
        totalEarnings: hist.totalEarnings,
        itemsCount: hist.items.length
      });

      // Compartilha GPS somente depois da retirada confirmada pelo servidor.
      const activeAsg = data.find(
        (a) =>
          a.status === 'picked_up' ||
          a.status === 'in_transit' ||
          (a as any).status === 'em_rota'
      );
      if (activeAsg) {
        trackingService.start(session?.driverId, activeAsg.assignmentId || activeAsg.id);
      } else if (trackingService.getState().isActive) {
        trackingService.stop(false);
      }
      return data;
    } catch {}
  }, [session]);

  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments]);

  // Polling periódico das atribuições em segundo plano a cada 3.5s para manter balcão e rotas sempre sincronizados
  useEffect(() => {
    if (!session) return;
    const interval = setInterval(() => {
      refreshAssignments();
    }, 3500);
    return () => clearInterval(interval);
  }, [session, refreshAssignments]);

  // Polling em tempo real para verificar novas ofertas disparadas pela loja e retirar imediatamente ofertas já aceitas por outro motoboy
  useEffect(() => {
    if (!session || !presence.manualEnabled) return;
    let live = true;
    const token = accountClient.getToken();
    const interval = setInterval(async () => {
      try {
        const offers = await api.getOffers();
        if (!live || accountClient.getToken() !== token || api.getSession()?.membershipId !== session.membershipId) return;
        const availableOffers = (offers || []).filter(
          (o) => !handledOfferIdsRef.current.has(o.offerId || o.id || '')
        );
        const availableIds = new Set(availableOffers.map(offer => offer.offerId || offer.id || ''));
        for (const id of noticedOfferIdsRef.current) if (!availableIds.has(id)) { removeNotice(`offer:${id}`); noticedOfferIdsRef.current.delete(id); }
        for (const offer of availableOffers) {
          const id = offer.offerId || offer.id;
          if (!id) continue;
          noticedOfferIdsRef.current.add(id);
          publishNotice({ id: `offer:${id}`, kind: 'offer', title: 'Nova entrega disponível!', message: `Você recebeu uma solicitação de ${offer.storeName || 'sua loja parceira'}.`, expiresAt: offer.expiresAt,
            onOpen: () => {
              if (accountClient.getToken() !== token || api.getSession()?.membershipId !== session.membershipId || handledOfferIdsRef.current.has(id) || Date.parse(offer.expiresAt) <= Date.now()) return;
              setActiveTab('orders'); setActiveDelivery(null); setPinTarget(null); setCurrentOffer(offer);
            },
          });
        }

        if (currentOffer) {
          const currentId = currentOffer.offerId || currentOffer.id;
          const stillAvailable = availableOffers.some((o) => (o.offerId || o.id) === currentId);
          if (!stillAvailable) {
            audioAlert.stopOfferAlert();
            setCurrentOffer(null);
            showToast('Esta oferta já foi aceita ou retirada.', 'info');
          }
        } else if (availableOffers.length > 0) {
          const offer = availableOffers[0];
          setCurrentOffer(offer);
          triggerOfferNotification(offer);
        }
      } catch {}
    }, 2500);

    return () => { live = false; clearInterval(interval); };
  }, [session, presence.manualEnabled, currentOffer, showToast]);

  // Modo Manter Tela Acesa (Screen Wake Lock) enquanto o entregador estiver ligado no suporte
  useEffect(() => {
    if (session && presence.manualEnabled) {
      requestScreenWakeLock();
    } else {
      releaseScreenWakeLock();
    }

    const handleVisibility = () => {
      if (document.visibilityState === 'visible' && session && presence.manualEnabled) {
        requestScreenWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      releaseScreenWakeLock();
    };
  }, [session, presence.manualEnabled]);

  // Validação periódica da sessão com o servidor (heartbeat a cada 30 segundos)
  useEffect(() => {
    if (!session) return;

    const heartbeat = setInterval(async () => {
      try {
        const res = await api.validateSession();
        if (!res.valid) {
          trackingService.stop(false); setSession(null);
          showToast('Sessão de plantão expirada ou encerrada pela loja.', 'error');
        }
      } catch { /* Falha de rede não encerra a conta. */ }
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
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.add(offerId);
      const res = await api.respondOffer(offerId, 'accepted');
      removeNotice(`offer:${offerId}`);
      setCurrentOffer(null);
      if (res && (res.assignment || (res as any).assignments)) {
        const newItems: Assignment[] = (res as any).assignments || (res.assignment ? [res.assignment] : []);
        setAssignments((prev) => {
          const map = new Map(prev.map((a) => [a.assignmentId || a.id, a]));
          for (const it of newItems) {
            map.set(it.assignmentId || it.id, it);
          }
          return Array.from(map.values());
        });
      }
      await refreshAssignments();
      publishNotice({ id: `offer:${offerId}:accepted`, kind: 'success', title: 'Entrega aceita!', message: 'Confira as informações para retirada.', onOpen: () => setActiveTab('orders') });
      setActiveTab('orders');
    } catch (err: any) {
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.add(offerId);
      setCurrentOffer(null);
      showToast(err.message || 'Erro ao aceitar oferta.', 'error');
    }
  };

  // Recusar Oferta
  const handleRejectOffer = async (offerId: string) => {
    try {
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.add(offerId);
      await api.respondOffer(offerId, 'rejected');
      removeNotice(`offer:${offerId}`);
      setCurrentOffer(null);
      showToast('Oferta recusada e devolvida ao despacho da loja.', 'info');
    } catch {
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.add(offerId);
      setCurrentOffer(null);
    }
  };

  // Oferta Expirada pelos 60s
  const handleOfferExpired = (offerId: string) => {
    removeNotice(`offer:${offerId}`);
    audioAlert.stopOfferAlert();
    handledOfferIdsRef.current.add(offerId);
    setCurrentOffer(null);
    showToast('Tempo limite de 60s esgotado. Oferta devolvida ao lojista.', 'info');
  };

  // Confirmar Retirada de Pedidos
  const handleConfirmPickup = async (assignmentIds: string[], pickupScopeIds: string[]) => {
    const res = await api.confirmPickup(assignmentIds, pickupScopeIds);
    setAssignments((previous) => previous.filter(assignment => !res.released.includes(assignment.assignmentId || assignment.id || '')).map(assignment =>
      res.confirmed.includes(assignment.assignmentId || assignment.id || '')
        ? {...assignment,status:'picked_up' as const} : assignment));
    if (res.confirmed[0]) {
      trackingService.start(session?.driverId, res.confirmed[0]);
    }
    await refreshAssignments();
    if (!res.confirmed.length) throw new Error(Object.values(res.errors).join(' ') || 'Nenhum pedido teve a retirada confirmada. Confira o balcão novamente.');
    const errorsCount = Object.keys(res.errors).length;
    showToast(`${res.confirmed.length} pedido(s) retirado(s). ${res.released.length} devolvido(s) ao despacho.${errorsCount ? ` Confira ${errorsCount} pedido(s) que não puderam ser confirmados.` : ''}`, errorsCount ? 'info' : 'success');
    setActiveTab('route');
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

    const refreshedAssignments = await refreshAssignments();
    const trackingDecision = deliveryTrackingDecision(
      refreshedAssignments || assignments,
      completedAssignment?.assignmentId || completedAssignment?.id,
      !isOfflinePending
    );

    if (isOfflinePending) {
      showToast('Entrega gravada no aparelho! Pendente de validação online com a loja.', 'info');
    } else {
      publishNotice({ id: `delivery:${completedAssignment?.assignmentId || completedAssignment?.id}:completed`, kind: 'success', title: 'Entrega finalizada!', message: 'Pedido entregue e validado pelo servidor da loja.', onOpen: () => setActiveTab('history') });
    }

    // Se concluiu a última entrega da rota, encerra sessão de GPS e abre a tela de Resumo de Rota
    if (trackingDecision.canFinishRoute) {
      trackingService.stop();
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
      trackingService.stop();
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
  const handleLogoutAccount = async () => {
    trackingService.stop(false);
    try { await api.logoutDriver(); showToast('Você saiu da sua conta.', 'info'); }
    catch (error) { setAccountNotice(error instanceof Error ? error.message : 'Falha ao sair.'); }
  };

  // Pedidos no balcão e na rota para os badges do bottom nav
  const waitingPickupCount = assignments.filter((a) => a.status === 'waiting_pickup').length;
  const activeDeliveries = assignments.filter((a) => a.status === 'picked_up' || a.status === 'in_transit');

  // FLUXO 1: Entregador NÃO está logado na sua conta pessoal -> Tela de Login / Cadastro
  if (!startupAnimationDone) return <StartupSplash />;

  if (!authHydrated) return <StartupSplash />;

  if (biometricLocked) return <main className="app-container nw-account-wait" aria-label="Acesso protegido">
    <img className="nw-account-wait-brand" src="/brand/novaesweb-entregador-ui.png" alt="NovaesWeb Entregador" />
    <div className="card-surface" style={{ margin: 20, padding: 22, textAlign: 'center', display: 'grid', gap: 14 }}>
      <h2 style={{ fontSize: 22 }}>Seu acesso está protegido</h2>
      <p>Use a digital ou o reconhecimento facial do seu aparelho para continuar.</p>
      <button type="button" className="btn-glove btn-glove-accent" onClick={() => void unlockBiometric()}>Desbloquear com digital ou rosto</button>
      <button type="button" className="btn-glove" onClick={() => {
        setBiometricLocked(false);
        setAccount(null);
        setUnlockError('');
        setAccountNotice('Entre com seu telefone e senha para recuperar o acesso.');
      }}>Entrar com telefone e senha</button>
      {unlockError && <p role="alert" style={{ color: 'var(--nw-red)' }}>{unlockError}</p>}
    </div>
  </main>;

  if (!account) {
    return (
      <div className="app-container">
        <ScreenAuthDriver
          notice={accountNotice}
          onLoginSuccess={(newAccount) => {
            setAccount(newAccount); setSession(api.getSession()); setPresence(api.getPresence()); setAccountReady(true); setAccountNotice('');
            showToast(`Bem-vindo(a), ${newAccount.name}!`, 'success');
          }}
        />

        <InAppNotice />
      </div>
    );
  }

  if (!accountReady) {
    return <main className="app-container nw-account-wait" aria-label="NovaesWeb Entregador">
      <img className="nw-account-wait-brand" src="/brand/novaesweb-entregador-ui.png" alt="NovaesWeb Entregador" />
      <aside className="nw-notice-host nw-notice-simple" aria-label="Conexão da conta">
        <div className="nw-notice">
          <div className="nw-notice-content" role="status" aria-live="polite" aria-atomic="true" aria-busy={!syncError}>
            <span className="nw-notice-icon" aria-hidden="true">{syncError ? <WifiOff size={21} /> : <span className="nw-account-wait-pulse" />}</span>
            <div className="nw-notice-copy"><strong>{syncError ? 'Vamos reconectar?' : 'Preparando seu acesso'}</strong><p>{syncError || 'Sincronizando sua conta com segurança. Só um instante…'}</p></div>
          </div>
          {syncError && <div className="nw-notice-actions">
            <button type="button" className="nw-notice-open" onClick={() => void syncAccount()}>Tentar novamente</button>
            <button type="button" onClick={() => void handleLogoutAccount()}>Sair da conta</button>
          </div>}
        </div>
      </aside>
    </main>;
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
            onShowToast={showToast}
          />
        )}

        <InAppNotice />
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
            <img src="/icon-192.png" className="brand-symbol" width="192" height="192" alt="" aria-hidden="true" decoding="async" />
            <span className="brand-wordmark">NovaesWeb<span>Entregador</span></span>
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
              <Store size={14} color="#FFB3E0" />
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
            onShowToast={showToast}
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
      <InAppNotice />

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
