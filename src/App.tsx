import { Capacitor } from '@capacitor/core';
import { ConnectionIsland } from './components/ConnectionIsland';
import { GlassBottomNav } from './components/GlassBottomNav';
import { useExperiencePreferences } from './services/experiencePreferences';
import { transitionDelivery } from './utils/viewTransition';
import { deliveryTrackingDecision } from './services/deliveryTrackingLifecycle';
import {
  readCachedAssignments,
  saveCachedAssignments,
  reconcileAssignmentsWithServer,
  readCachedHistory,
  saveCachedHistory,
  saveCachedLedger,
  clearDriverSnapshotOnLogout,
} from './services/driverDataSnapshot';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Store,
  WifiOff,
  Settings,
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
import { accountClient } from './services/accountClient';
import { realtimeWatcher, setRealtimeToken } from './services/realtimeWatcher';
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
import { ScreenSettings } from './components/ScreenSettings';
import { ScreenDashboard } from './components/ScreenDashboard';
import { ModalOfferReceived } from './components/ModalOfferReceived';
import { ScreenOrdersPickup } from './components/ScreenOrdersPickup';
import { ScreenRoute } from './components/ScreenRoute';
import { ScreenActiveDelivery } from './components/ScreenActiveDelivery';
import { ScreenPinConfirm } from './components/ScreenPinConfirm';
import { ScreenHistory } from './components/ScreenHistory';
import { DriverLoadingSkeleton } from './components/DriverLoadingSkeleton';
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
  const { preferences } = useExperiencePreferences();
  void preferences;

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
  const [activeDeliverySnapshot, setActiveDelivery] = useState<Assignment | null>(null);
  const [pinTarget, setPinTarget] = useState<Assignment | null>(null);
  const routeDeliveredRef = useRef<Map<string, number | null>>(new Map());

  // Estados de Dados
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentsLoadState, setAssignmentsLoadState] = useState<'loading' | 'ready' | 'error'>(session ? 'loading' : 'ready');
  hasActiveDeliveryRef.current = assignments.some(item => ['waiting_pickup', 'picked_up', 'in_transit'].includes(item.status));
  const [currentOffer, setCurrentOffer] = useState<Offer | null>(null);
  const handledOfferIdsRef = useRef<Set<string>>(new Set());
  const noticedOfferIdsRef = useRef<Set<string>>(new Set());
  const noticeSequence = useRef(0);
  const noticeAssignmentStates = useRef<Map<string, string>>(new Map());
  const assignmentsRevision = useRef(0);
  const [historySummary, setHistorySummary] = useState({ totalEarnings: 0, itemsCount: 0 });

  // Modais de Apoio
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [isProfileLedgerOpen, setIsProfileLedgerOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
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
      if (result.account?.id) saveCachedLedger(result.account.id, api.getStoresLedger());
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
      setIsStoreModalOpen(false); setIsProfileLedgerOpen(false); setIsSettingsOpen(false); setWithdrawTarget(null);
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
      setIsProfileLedgerOpen(false); setIsSettingsOpen(false); setIsStoreModalOpen(false);
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

  // Monitora conectividade real
  useEffect(() => {
    const unsubscribe = offlineQueue.subscribe(() => {
      setIsOnline(offlineQueue.getIsOnline());
    });
    return () => unsubscribe();
  }, []);

  // Apenas primeira carga e troca de loja exibem skeleton: polling e atualizações preservam snapshot local.
  useEffect(() => {
    const cachedAssignments = session ? readCachedAssignments(account?.id, session.storeId) : [];
    const cachedHistory = session ? readCachedHistory(account?.id, session.storeId) : null;
    setAssignments(cachedAssignments);
    setAssignmentsLoadState(session ? (cachedAssignments.length > 0 ? 'ready' : 'loading') : 'ready');
    if (cachedHistory) {
      setHistorySummary({
        totalEarnings: cachedHistory.totalEarnings,
        itemsCount: cachedHistory.items.length,
      });
    }
  }, [account?.id, session?.membershipId, session?.driverId, session?.storeId]);

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
      const queuedIds = new Set(
        offlineQueue.getQueue()
          .filter(cmd => cmd.action === 'delivery_confirm')
          .map(cmd => String(cmd.payload?.assignmentId || ''))
          .filter(Boolean)
      );
      const mergedAssignments = reconcileAssignmentsWithServer(
        readCachedAssignments(account?.id, session.storeId),
        data,
        queuedIds
      );
      setAssignments(mergedAssignments);
      saveCachedAssignments(account?.id, session.storeId, mergedAssignments);
      setAssignmentsLoadState('ready');
      if (hist) {
        saveCachedHistory(account?.id, session.storeId, hist);
        setHistorySummary({
          totalEarnings: hist.totalEarnings,
          itemsCount: hist.items.length
        });
      }

      // Compartilha GPS somente após clicar em Iniciar Rota na aba Minha Rota.
      const activeAsg = mergedAssignments.find(
        (a) =>
          a.status === 'in_transit' ||
          a.status === 'em_rota' ||
          (a.status === 'picked_up' && Boolean(a.routeStartedAt))
      );
      if (activeAsg) {
        trackingService.start(session?.driverId, activeAsg.assignmentId || activeAsg.id);
      } else if (trackingService.getState().isActive) {
        trackingService.stop(false);
      }
      return mergedAssignments;
    } catch {
      if (requestRevision === assignmentsRevision.current) {
        const cached = readCachedAssignments(account?.id, session.storeId);
        setAssignmentsLoadState(current => (cached.length > 0 ? 'ready' : current === 'loading' ? 'error' : current));
      }
    }
  }, [account?.id, session]);

  useEffect(() => {
    refreshAssignments();
  }, [refreshAssignments]);

  // Agenda reenvio automático da fila offline respeitando backoff exponencial
  useEffect(() => {
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleFlush = () => {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
      if (!offlineQueue.getIsOnline() || !accountReady || !session) return;
      const pending = offlineQueue.getQueue().filter(c => c.status === 'pending');
      if (!pending.length) return;
      const nextAt = Math.min(...pending.map(c => (typeof c.retryAt === 'number' ? c.retryAt : Date.now())));
      const delay = Math.max(50, nextAt - Date.now());
      retryTimer = setTimeout(() => {
        if (offlineQueue.getIsOnline()) void api.flushOfflineQueue().then(() => refreshAssignments()).catch(() => {});
      }, delay);
    };
    const unsubscribe = offlineQueue.subscribe(scheduleFlush);
    scheduleFlush();
    return () => {
      if (retryTimer) clearTimeout(retryTimer);
      unsubscribe();
    };
  }, [accountReady, session, refreshAssignments]);

  // Tempo real: a loja avisa pelo Supabase Realtime e só então consultamos.
  // A consulta lenta de segurança (60s) cobre aviso perdido/app em segundo plano,
  // substituindo o polling de 3,5s que gastava rede e bateria sem necessidade.
  useEffect(() => {
    if (!session?.token) { void realtimeWatcher.disconnect(); return; }
    setRealtimeToken(session.token);
    const unsubscribe = realtimeWatcher.onUpdate(() => { refreshAssignments(); });
    void realtimeWatcher.connect(session.token);
    return () => { unsubscribe(); void realtimeWatcher.disconnect(); };
  }, [session?.token, refreshAssignments]);

  // Ofertas: busca no tempo real (aviso da loja) + consulta lenta de segurança.
  // Antes era um polling fixo de 2,5s; agora só consultamos quando algo muda.
  useEffect(() => {
    if (!session || !presence.manualEnabled) return;
    let live = true;
    const token = accountClient.getToken();
    const pollOffers = async () => {
      if (!live) return;
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
          if (noticedOfferIdsRef.current.has(id)) continue;
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
    };

    void pollOffers();
    const interval = setInterval(pollOffers, 60_000);
    const unsubscribe = realtimeWatcher.onUpdate(() => { void pollOffers(); });
    const onFocus = () => { void pollOffers(); };
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onFocus);

    return () => {
      live = false;
      clearInterval(interval);
      unsubscribe();
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('online', onFocus);
    };
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


  // Handler de Ligado/Desligado
  const handleTogglePresence = async () => {
    const newStatus = !presence.manualEnabled;
    try {
      const updated = await api.setPresence(newStatus);
      setPresence(updated);
      if (newStatus) {
        showToast('Você está LIGADO e disponível para receber novas corridas.', 'success');
      } else {
        showToast('Você está DESLIGADO. Conclua os pedidos em andamento sem receber novas ofertas.', 'info');
      }
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Não foi possível alterar sua disponibilidade.', 'error');
    }
  };

  // Aceitar Oferta
  const handleAcceptOffer = async (offerId: string) => {
    if (handledOfferIdsRef.current.has(offerId)) return;
    let accepted = false;
    try {
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.add(offerId);
      const res = (await api.respondOffer(offerId, 'accepted')) as { assignment?: Assignment; assignments?: Assignment[] };
      accepted = true;
      removeNotice(`offer:${offerId}`);
      setCurrentOffer(null);
      if (res && (res.assignment || res.assignments)) {
        const newItems: Assignment[] = res.assignments || (res.assignment ? [res.assignment] : []);
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
      if (!accepted) handledOfferIdsRef.current.delete(offerId);
      setCurrentOffer(null);
      showToast(err.message || 'Erro ao aceitar oferta.', 'error');
    }
  };

  // Recusar Oferta
  const handleRejectOffer = async (offerId: string) => {
    if (handledOfferIdsRef.current.has(offerId)) return;
    try {
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.add(offerId);
      await api.respondOffer(offerId, 'rejected');
      removeNotice(`offer:${offerId}`);
      setCurrentOffer(null);
      showToast('Oferta recusada e devolvida ao despacho da loja.', 'info');
    } catch (err: any) {
      audioAlert.stopOfferAlert();
      handledOfferIdsRef.current.delete(offerId);
      setCurrentOffer(null);
      showToast(err.message || 'Não foi possível recusar a oferta. Tente novamente.', 'error');
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

  // Confirmar Retirada de Pedidos (envia para Minha Rota aguardando clique em Iniciar rota)
  const handleConfirmPickup = async (assignmentIds: string[], pickupScopeIds: string[]) => {
    const res = await api.confirmPickup(assignmentIds, pickupScopeIds);
    setAssignments((previous) => {
      const next = previous
        .filter(assignment => !res.released.includes(assignment.assignmentId || assignment.id || ''))
        .map(assignment =>
          res.confirmed.includes(assignment.assignmentId || assignment.id || '')
            ? { ...assignment, status: 'picked_up' as const }
            : assignment
        );
      saveCachedAssignments(account?.id, session?.storeId, next);
      return next;
    });
    await refreshAssignments();
    if (!res.confirmed.length) throw new Error(Object.values(res.errors).join(' ') || 'Nenhum pedido teve a retirada confirmada. Confira o balcão novamente.');
    const errorsCount = Object.keys(res.errors).length;
    showToast(`${res.confirmed.length} pedido(s) retirado(s) enviados para Minha Rota. Toque em Iniciar rota quando sair.`, errorsCount ? 'info' : 'success');
    setActiveTab('route');
  };

  // Reordenar Rota
  const handleReorderRoute = async (stops: { assignmentId: string; sequence: number; routeEstimate?: any }[]) => {
    await api.reorderRoute(stops);
    await refreshAssignments();
    showToast('Nova sequência da rota salva com sucesso!', 'success');
  };

  // Iniciar Rota explicitamente — só aqui libera o mapa ao vivo no painel do cliente
  const handleStartRoute = async (stopsToStart: Assignment[]) => {
    const ids = stopsToStart.map((stop) => stop.assignmentId || stop.id || '').filter(Boolean);
    if (!ids.length) return;
    const res = await api.startRoute(ids);
    const startedAt = res.routeStartedAt || new Date().toISOString();
    setAssignments((previous) => {
      const next = previous.map((assignment) => {
        const key = assignment.assignmentId || assignment.id || '';
        return res.startedIds.includes(key) || ids.includes(key)
          ? { ...assignment, status: 'in_transit' as const, routeStartedAt: assignment.routeStartedAt || startedAt }
          : assignment;
      });
      saveCachedAssignments(account?.id, session?.storeId, next);
      return next;
    });
    trackingService.start(session?.driverId, res.startedIds[0] || ids[0]);
    await refreshAssignments();
    showToast('Rota iniciada! O mapa ao vivo foi liberado para os clientes.', 'success');
  };

  // Sucesso na Entrega com PIN
  const handleDeliverySuccess = async (_message: string, isOfflinePending?: boolean) => {
    const completedAssignment = pinTarget || activeDeliverySnapshot;
    const completedId = completedAssignment?.assignmentId || completedAssignment?.id || '';
    const activeKey = completedAssignment ? (completedAssignment.assignmentId || completedAssignment.id || completedAssignment.orderId) : '';
    setPinTarget(null);
    setActiveDelivery(null);

    if (activeKey) {
      try {
        localStorage.removeItem(`nw:gate-wait:${activeKey}`);
        localStorage.removeItem(`nw:gate-extra:${activeKey}`);
      } catch { /* noop */ }
    }

    if (isOfflinePending && completedId) {
      setAssignments((prev) => {
        const next = prev.map((item) =>
          (item.assignmentId || item.id || '') === completedId ? { ...item, isPendingSync: true } : item
        );
        saveCachedAssignments(account?.id, session?.storeId, next);
        return next;
      });
    }

    if (completedId) {
      routeDeliveredRef.current.set(
        completedId,
        typeof completedAssignment?.deliveryFee === 'number' && Number.isFinite(completedAssignment.deliveryFee)
          ? completedAssignment.deliveryFee
          : null
      );
    }

    const refreshedAssignments = await refreshAssignments();
    const trackingDecision = deliveryTrackingDecision(
      refreshedAssignments || assignments,
      completedId || undefined,
      !isOfflinePending
    );

    if (isOfflinePending) {
      showToast('Entrega gravada no aparelho! Pendente de validação online com a loja.', 'info');
    } else {
      publishNotice({ id: `delivery:${completedId}:completed`, kind: 'success', title: 'Entrega finalizada!', message: 'Pedido entregue e validado pelo servidor da loja.', onOpen: () => setActiveTab('history') });
    }

    // Se concluiu a última entrega da rota, encerra sessão de GPS e abre a tela de Resumo de Rota
    if (trackingDecision.canFinishRoute) {
      trackingService.stop();
      const deliveredEntries = Array.from(routeDeliveredRef.current.values());
      const count = Math.max(1, deliveredEntries.length);
      const fees = deliveredEntries.reduce<number>((sum, fee) => sum + (typeof fee === 'number' ? fee : 0), 0);
      const hasUninformed = deliveredEntries.some((fee) => fee === null);
      routeDeliveredRef.current.clear();
      setRouteCompletedStats({ count, fees, hasUninformed });
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
      routeDeliveredRef.current.clear();
      setSession(null);
      setIsStoreModalOpen(false);
      setIsProfileLedgerOpen(false);
      setIsSettingsOpen(false);
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
    const currentAccountId = account?.id;
    trackingService.stop(false);
    routeDeliveredRef.current.clear();
    try {
      await api.logoutDriver();
      clearDriverSnapshotOnLogout(currentAccountId);
      setIsSettingsOpen(false);
      setIsProfileLedgerOpen(false);
      setIsStoreModalOpen(false);
      showToast('Você saiu da sua conta.', 'info');
    }
    catch (error) { setAccountNotice(error instanceof Error ? error.message : 'Falha ao sair.'); }
  };

  const activeDeliveryId = activeDeliverySnapshot
    ? (activeDeliverySnapshot.assignmentId || activeDeliverySnapshot.id || activeDeliverySnapshot.orderId)
    : null;
  const activeDelivery = activeDeliverySnapshot
    ? (assignments.find((a) => (a.assignmentId || a.id || a.orderId) === activeDeliveryId) || activeDeliverySnapshot)
    : null;

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
        const currentAccountId = account?.id;
        trackingService.stop(false);
        accountClient.clear('Entre com seu telefone e senha para recuperar o acesso.');
        clearDriverSnapshotOnLogout(currentAccountId);
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
      {!syncError && <DriverLoadingSkeleton variant="account" />}
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
      <div className="app-container app-container--connect">
        <ScreenStoreConnect
          account={account}
          onShiftStarted={(newSession) => {
            setSession(newSession);
            setPresence(api.getPresence());
            refreshAssignments();
            showToast(`Plantão iniciado na ${newSession.storeName}!`, 'success');
          }}
          onLogout={() => { void handleLogoutAccount(); }}
        />
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
                setIsSettingsOpen(true);
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
              aria-label="Abrir configurações"
            >
              <Settings size={17} />
            </button>
          </div>
        </div>

        <ConnectionIsland online={isOnline} />
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
            onBack={() => transitionDelivery(() => setActiveDelivery(null))}
            onOpenPinConfirmation={(asg) => setPinTarget(asg)}
            onRequestWithdraw={(asg) => setWithdrawTarget({ assignment: asg, isException: false })}
          />
        ) : (
          <>
            {assignmentsLoadState === 'loading' && activeTab !== 'history' ? (
              <DriverLoadingSkeleton variant={activeTab === 'orders' ? 'orders' : activeTab === 'route' ? 'route' : 'dashboard'} />
            ) : assignmentsLoadState === 'error' && activeTab !== 'history' ? (
              <section className="nw-skeleton-error card-surface" role="alert">
                <h2>Não foi possível carregar os pedidos</h2>
                <p>Confira sua internet e tente novamente. Nenhum pedido foi removido.</p>
                <button className="btn-glove btn-glove-accent" type="button" onClick={() => { setAssignmentsLoadState('loading'); void refreshAssignments(); }}>Tentar novamente</button>
              </section>
            ) : <>
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
                onStartRoute={handleStartRoute}
                onSelectDelivery={(asg) => transitionDelivery(() => setActiveDelivery(asg))}
                onNavigateToOrders={() => setActiveTab('orders')}
              />
            )}

            {/* Tela 8: Histórico & Ganhos */}
            {activeTab === 'history' && <ScreenHistory />}
            </>}
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

      {/* Modal de Loja Ativa */}
      {isStoreModalOpen && (
        <ModalSessionAndStore
          session={session}
          onClose={() => setIsStoreModalOpen(false)}
          onCloseShift={handleCloseStoreShift}
        />
      )}

      {/* Modal de Perfil & Extrato por Loja */}
      {isProfileLedgerOpen && !isStoreModalOpen && (
        <ScreenProfileLedger
            account={account}
            activeSession={session}
            onClose={() => setIsProfileLedgerOpen(false)}
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

      {isSettingsOpen && account && (
        <ScreenSettings
          account={account}
          activeSession={session}
          onClose={() => setIsSettingsOpen(false)}
          onCloseShift={handleCloseStoreShift}
          onLogoutAccount={handleLogoutAccount}
          onShowToast={showToast}
        />
      )}

      {/* Toast Notifier Flutuante */}
      <InAppNotice />

      <GlassBottomNav
        active={activeDelivery || pinTarget ? 'route' : activeTab}
        waitingCount={waitingPickupCount}
        routeCount={activeDeliveries.length}
        onNavigate={tab => {
          audioAlert.playClickSound();
          setActiveDelivery(null); setPinTarget(null); setActiveTab(tab);
        }}
      />
    </div>
  );
};

export default App;

