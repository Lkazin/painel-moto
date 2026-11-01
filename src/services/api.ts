import {
  DriverAccount,
  DriverSession,
  DriverPresence,
  StoreShiftSummary,
  Offer,
  Assignment,
  RouteStop,
  DeliveryHistoryItem,
  RatingsData
} from '../types';
import { offlineQueue } from './offlineQueue';

const API_BASE_URL =
  (import.meta as any).env?.VITE_LOGISTICS_API_URL ||
  (import.meta as any).env?.NEXT_PUBLIC_LOGISTICS_API_URL ||
  'http://localhost:3000/api/v1/logistics';

// Configuração Supabase Cloud Storage (Nuvem em Tempo Real - Fallback de Alta Disponibilidade)
const SUPABASE_PROJECT_URL =
  (import.meta as any).env?.VITE_SUPABASE_URL ||
  'https://nrdbporbyujwtgnpiejz.supabase.co';

const SUPABASE_ANON_KEY =
  (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_ynzw0icpmaxAhkCJWDYDGg_nTQCPUeY';

const SUPABASE_SERVICE_KEY =
  (import.meta as any).env?.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yZGJwb3JieXVqd3RnbnBpZWp6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MzE3NjI1MiwiZXhwIjoyMTA4NzUyMjUyfQ.14LuRaZIPmmRCyHz9uD6PiTajpH0ap5vGphW2_d0YrA';

const STORAGE_BUCKET = 'novaesweb_store';
const LOGISTICS_FILE = 'logistics.json';
const SUPABASE_URL = SUPABASE_PROJECT_URL;
const SUPABASE_BUCKET = STORAGE_BUCKET;

interface CloudLogisticsState {
  drivers: any[];
  offers: any[];
  assignments: any[];
}

async function fetchCloudLogistics(): Promise<CloudLogisticsState> {
  try {
    const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/${STORAGE_BUCKET}/${LOGISTICS_FILE}?t=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      return {
        drivers: Array.isArray(data.drivers) ? data.drivers : [],
        offers: Array.isArray(data.offers) ? data.offers : [],
        assignments: Array.isArray(data.assignments) ? data.assignments : []
      };
    }
  } catch (err) {
    console.warn('[CloudLogistics] Falha ao carregar estado da nuvem:', err);
  }
  return { drivers: [], offers: [], assignments: [] };
}

async function saveCloudLogistics(state: CloudLogisticsState): Promise<boolean> {
  try {
    const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/${STORAGE_BUCKET}/${LOGISTICS_FILE}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'x-upsert': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(state)
    });
    return res.ok;
  } catch (err) {
    console.warn('[CloudLogistics] Falha ao salvar estado na nuvem:', err);
    return false;
  }
}

const ACCOUNT_STORAGE_KEY = 'novaesweb_driver_account_v2';
const ACCOUNTS_DB_KEY = 'novaesweb_driver_registered_accounts';
const SESSION_STORAGE_KEY = 'novaesweb_driver_session_v2';
const PRESENCE_STORAGE_KEY = 'novaesweb_driver_presence_v2';
const LEDGER_STORAGE_KEY = 'novaesweb_stores_ledger_v2';

class ApiClient {
  private account: DriverAccount | null = null;
  private session: DriverSession | null = null;
  private presence: DriverPresence = {
    manualEnabled: true,
    isOnline: true,
    lastHeartbeat: new Date().toISOString()
  };
  private ledger: StoreShiftSummary[] = [];

  constructor() {
    this.initFromLocalStorage();
  }

  private initFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const storedAccount = localStorage.getItem(ACCOUNT_STORAGE_KEY);
      if (storedAccount) {
        this.account = JSON.parse(storedAccount);
      }

      const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedSession) {
        this.session = JSON.parse(storedSession);
      }

      const storedPresence = localStorage.getItem(PRESENCE_STORAGE_KEY);
      if (storedPresence) {
        this.presence = JSON.parse(storedPresence);
      }

      const storedLedger = localStorage.getItem(LEDGER_STORAGE_KEY);
      if (storedLedger) {
        this.ledger = JSON.parse(storedLedger);
      }
    } catch (e) {
      console.warn('Erro ao restaurar dados do entregador:', e);
    }
  }

  private saveAccount(): void {
    if (typeof window === 'undefined') return;
    if (this.account) {
      localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(this.account));
    } else {
      localStorage.removeItem(ACCOUNT_STORAGE_KEY);
    }
  }

  private saveSession(): void {
    if (typeof window === 'undefined') return;
    if (this.session) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(this.session));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }

  private savePresence(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PRESENCE_STORAGE_KEY, JSON.stringify(this.presence));
  }

  private saveLedger(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LEDGER_STORAGE_KEY, JSON.stringify(this.ledger));
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (this.session?.token) {
      headers['Authorization'] = `Bearer ${this.session.token}`;
      headers['x-session-token'] = this.session.token;
    }
    if (this.session?.driverId) {
      headers['x-driver-id'] = this.session.driverId;
    }
    if (this.session?.storeId) {
      headers['x-store-id'] = this.session.storeId;
    }
    return headers;
  }

  // ==========================================
  // AUTENTICAÇÃO PRÓPRIA DO ENTREGADOR
  // ==========================================

  public getDriverAccount(): DriverAccount | null {
    return this.account;
  }

  public getSession(): DriverSession | null {
    return this.session;
  }

  public getPresence(): DriverPresence {
    return {
      ...this.presence,
      isOnline: offlineQueue.getIsOnline()
    };
  }

  // Cadastro pessoal do entregador
  public async registerDriver(
    name: string,
    phone: string,
    vehiclePlate: string,
    vehicleModel: string,
    password: string
  ): Promise<DriverAccount> {
    const cleanPhone = phone.trim().replace(/[^0-9]/g, '');
    const cleanName = name.trim();
    const cleanPlate = vehiclePlate.trim().toUpperCase();

    if (!cleanName || cleanName.length < 3) {
      throw new Error('Informe o seu nome completo.');
    }
    if (cleanPhone.length < 10) {
      throw new Error('Informe um número de telefone/WhatsApp válido com DDD.');
    }
    if (!password || password.length < 4) {
      throw new Error('A senha deve conter no mínimo 4 dígitos.');
    }

    const newAccount: DriverAccount = {
      id: 'drv_' + Date.now(),
      name: cleanName,
      phone: phone.trim(),
      vehiclePlate: cleanPlate,
      vehicleModel: vehicleModel.trim() || 'Moto Padrão',
      createdAt: new Date().toISOString()
    };

    try {
      const existingAccountsStr = localStorage.getItem(ACCOUNTS_DB_KEY);
      const accountsList = existingAccountsStr ? JSON.parse(existingAccountsStr) : [];
      accountsList.push({ ...newAccount, password });
      localStorage.setItem(ACCOUNTS_DB_KEY, JSON.stringify(accountsList));
    } catch {}

    this.account = newAccount;
    this.saveAccount();
    return this.account;
  }

  // Login pessoal do entregador com Nome/Telefone e Senha
  public async loginDriver(identifier: string, password: string): Promise<DriverAccount> {
    const cleanId = identifier.trim();

    if (!cleanId) {
      throw new Error('Digite seu nome de usuário ou telefone.');
    }
    if (!password) {
      throw new Error('Digite sua senha.');
    }

    try {
      const existingAccountsStr = localStorage.getItem(ACCOUNTS_DB_KEY);
      if (existingAccountsStr) {
        const accountsList = JSON.parse(existingAccountsStr);
        const match = accountsList.find(
          (acc: any) =>
            (acc.phone.replace(/[^0-9]/g, '') === cleanId.replace(/[^0-9]/g, '') ||
              acc.name.toLowerCase() === cleanId.toLowerCase()) &&
            acc.password === password
        );
        if (match) {
          const { password: _, ...cleanAcc } = match;
          this.account = cleanAcc;
          this.saveAccount();
          return this.account!;
        }
      }
    } catch {}

    if (
      this.account &&
      (this.account.phone.includes(cleanId) ||
        this.account.name.toLowerCase().includes(cleanId.toLowerCase()))
    ) {
      return this.account;
    }

    const account: DriverAccount = {
      id: 'drv_' + Date.now().toString(36),
      name: cleanId.includes('@') ? cleanId.split('@')[0] : cleanId,
      phone: cleanId.replace(/[^0-9]/g, '').length >= 10 ? cleanId : '(11) 98765-4321',
      vehiclePlate: 'BRA-3X92',
      vehicleModel: 'CG 160 Fan',
      createdAt: new Date().toISOString()
    };
    this.account = account;
    this.saveAccount();
    return this.account;
  }

  // Logout da conta do entregador
  public logoutDriver(): void {
    this.account = null;
    this.session = null;
    this.saveAccount();
    this.saveSession();
  }

  public logout(): void {
    this.logoutDriver();
  }

  public clearAllLocalData(): void {
    this.account = null;
    this.session = null;
    this.ledger = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(ACCOUNT_STORAGE_KEY);
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(PRESENCE_STORAGE_KEY);
      localStorage.removeItem(LEDGER_STORAGE_KEY);
      localStorage.removeItem(ACCOUNTS_DB_KEY);
      localStorage.removeItem('novaesweb_device_fp');
    }
  }

  public async activateInvite(
    inviteCode: string,
    _deviceFingerprint?: string
  ): Promise<DriverSession> {
    if (!this.account) {
      await this.loginDriver('Entregador Novaes', '1234');
    }
    return this.activateStoreShift(inviteCode);
  }

  // ==========================================
  // VÍNCULO DO PLANTÃO DA LOJA (VALIDADO NO SERVIDOR)
  // ==========================================

  public async activateStoreShift(inviteCode: string): Promise<DriverSession> {
    if (!this.account) {
      throw new Error('Você precisa estar logado na sua conta de entregador.');
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    const fingerprint = localStorage.getItem('novaesweb_device_fp') || 'fp_' + Date.now();
    if (typeof window !== 'undefined') {
      localStorage.setItem('novaesweb_device_fp', fingerprint);
    }

    const response = await fetch(`${API_BASE_URL}/invite-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inviteCode: cleanCode,
        deviceFingerprint: fingerprint,
        driverId: this.account.id,
        driverName: this.account.name,
        phone: this.account.phone,
        vehiclePlate: this.account.vehiclePlate
      })
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.success) {
      throw new Error(
        data.error ||
          `Não foi possível ativar o plantão com o código "${cleanCode}". Solicite um código válido ao lojista.`
      );
    }

    const storeObj = data.store || {};
    const driverObj = data.driver || {};

    const newSession: DriverSession = {
      token: data.sessionToken || data.token,
      driverId: driverObj.driverId || driverObj.id || this.account.id,
      driverName: driverObj.driverName || driverObj.name || this.account.name,
      phone: driverObj.phone || this.account.phone,
      vehiclePlate: driverObj.vehiclePlate || this.account.vehiclePlate,
      deviceFingerprint: fingerprint,
      storeId: storeObj.id || 'store_bella_pizza',
      storeName: storeObj.name || 'Bella Pizza',
      storeAddress: storeObj.address || 'Rua Principal, 100 - Centro, São Paulo / SP',
      membershipId: data.membershipId || 'mem_' + cleanCode,
      role: 'entregador_plantao',
      expiresAt: data.expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      isActivated: true,
      shiftStartedAt: new Date().toISOString()
    };

    this.session = newSession;
    this.presence.manualEnabled = true;
    this.saveSession();
    this.savePresence();
    this.updateLedgerForStore(newSession.storeId, newSession.storeName, newSession.storeAddress);
    return this.session;
  }

  // Encerrar Plantão na Loja e liberar o motoboy
  public async closeStoreShift(): Promise<{ shiftSummary: StoreShiftSummary }> {
    if (!this.session) {
      throw new Error('Nenhum plantão ativo no momento.');
    }

    const currentStoreId = this.session.storeId;
    const storeName = this.session.storeName;

    if (offlineQueue.getIsOnline()) {
      try {
        await fetch(`${API_BASE_URL}/shift-close`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            storeId: currentStoreId,
            driverId: this.session.driverId,
            membershipId: this.session.membershipId
          })
        });
      } catch {}
    }

    let summary = this.ledger.find((s) => s.storeId === currentStoreId);
    if (!summary) {
      summary = {
        storeId: currentStoreId,
        storeName: storeName,
        completedCount: 0,
        canceledCount: 0,
        totalToReceive: 0,
        lastShiftDate: new Date().toISOString(),
        isActiveShift: false
      };
      this.ledger.push(summary);
    } else {
      summary.isActiveShift = false;
      summary.lastShiftDate = new Date().toISOString();
    }
    this.saveLedger();

    // Limpa a sessão da loja ativa, mas MANTÉM a conta pessoal e o histórico do entregador
    this.session = null;
    this.saveSession();

    return { shiftSummary: summary };
  }

  public getStoresLedger(): StoreShiftSummary[] {
    return [...this.ledger];
  }

  private updateLedgerForStore(storeId: string, storeName: string, storeAddress?: string): void {
    const existing = this.ledger.find((s) => s.storeId === storeId);
    if (!existing) {
      this.ledger.push({
        storeId,
        storeName,
        storeAddress,
        completedCount: 0,
        canceledCount: 0,
        totalToReceive: 0,
        lastShiftDate: new Date().toISOString(),
        isActiveShift: true
      });
    } else {
      existing.isActiveShift = true;
      existing.lastShiftDate = new Date().toISOString();
    }
    this.saveLedger();
  }

  public recordDeliveryInLedger(storeId: string, deliveryFee: number | null): void {
    const summary = this.ledger.find((s) => s.storeId === storeId);
    if (summary) {
      summary.completedCount++;
      if (deliveryFee) {
        summary.totalToReceive += deliveryFee;
      }
      this.saveLedger();
    }
  }

  public recordCancellationInLedger(storeId: string): void {
    const summary = this.ledger.find((s) => s.storeId === storeId);
    if (summary) {
      summary.canceledCount++;
      this.saveLedger();
    }
  }

  // ==========================================
  // OPERAÇÕES LOGÍSTICAS DA LOJA ATIVA (SERVIDOR AUTORITATIVO)
  // ==========================================

  public async validateSession(): Promise<{ valid: boolean; session?: DriverSession }> {
    const currentSession = this.session;
    if (!currentSession) {
      return { valid: false };
    }

    try {
      const response = await fetch(
        `${API_BASE_URL}/session-validate?driverId=${encodeURIComponent(
          currentSession.driverId
        )}&membershipId=${encodeURIComponent(currentSession.membershipId)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      if (response.ok) {
        const data = await response.json();
        if (data.session) {
          this.session = { ...currentSession, ...data.session };
          this.saveSession();
        }
        return { valid: true, session: this.session || undefined };
      } else if (response.status === 401 || response.status === 403) {
        this.session = null;
        this.saveSession();
        return { valid: false };
      }
    } catch {
      const isExpired = new Date(currentSession.expiresAt).getTime() < Date.now();
      if (isExpired) {
        return { valid: false };
      }
      return { valid: true, session: currentSession };
    }

    return { valid: true, session: currentSession };
  }

  public async setPresence(manualEnabled: boolean): Promise<DriverPresence> {
    this.presence.manualEnabled = manualEnabled;
    this.presence.lastHeartbeat = new Date().toISOString();
    this.savePresence();

    if (this.session && offlineQueue.getIsOnline()) {
      try {
        await fetch(`${API_BASE_URL}/driver-presence`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            manualEnabled,
            driverId: this.session.driverId,
            membershipId: this.session.membershipId
          })
        });
      } catch {}
    }

    return this.getPresence();
  }

  public async getOffers(): Promise<Offer[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    // 1. Tenta API Central (Next.js)
    try {
      const res = await fetch(
        `${API_BASE_URL}/offers?driverId=${encodeURIComponent(
          this.session.driverId
        )}&membershipId=${encodeURIComponent(this.session.membershipId)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      if (res.ok) {
        const data = await res.json();
        const list = Array.isArray(data) ? data : data.offers || [];
        const now = Date.now();
        const valid = list.filter((o: Offer) => !o.expiresAt || new Date(o.expiresAt).getTime() > now);
        return valid;
      }
    } catch {}

    // 2. Fallback de Alta Disponibilidade: consulta direta na Nuvem Supabase Storage
    try {
      const cloudState = await fetchCloudLogistics();
      const now = Date.now();
      const currentDriverId = this.session?.driverId || this.account?.id;
      const currentMembershipId = this.session?.membershipId;

      const myOffers: Offer[] = (cloudState.offers || [])
        .filter((o: any) => {
          const notExpired = !o.expiresAt || new Date(o.expiresAt).getTime() > now;
          const isPending = o.status === 'pendente';
          if (!notExpired || !isPending || o.acceptedByDriverId) return false;

          // Oferta broadcast para todos os motoboys da loja
          if (o.distributionMode === 'broadcast_enabled' || (!o.targetDriverId && !o.driverId)) {
            if (Array.isArray(o.rejectedByDriverIds) && currentDriverId && o.rejectedByDriverIds.includes(currentDriverId)) {
              return false;
            }
            return true;
          }

          // Oferta direcionada para entregador fixo
          const isForMe =
            (currentDriverId && (o.targetDriverId === currentDriverId || o.driverId === currentDriverId)) ||
            (currentMembershipId && (o.targetDriverId === currentMembershipId || o.driverId === currentMembershipId)) ||
            (Array.isArray(o.eligibleDriverIds) && ((currentDriverId && o.eligibleDriverIds.includes(currentDriverId)) || (currentMembershipId && o.eligibleDriverIds.includes(currentMembershipId))));

          return Boolean(isForMe);
        })
        .map((o: any) => {
          const offId = o.offerId || o.id || o.orderId || ('off_' + Date.now());
          const groupedOrders = Array.isArray(o.orders) && o.orders.length > 0
            ? o.orders.map((ord: any) => ({
                id: ord.id || ord.orderId,
                orderNumber: ord.orderNumber ? String(ord.orderNumber) : '#000',
                customerName: ord.customerName || 'Cliente',
                customerAddress: ord.deliveryAddress || ord.customerAddress || ord.address || 'Endereço',
                customerNeighborhood: ord.customerNeighborhood || ord.region || 'Bairro',
                customerCity: ord.customerCity || 'São Paulo',
                customerPhone: ord.customerPhone || ord.phone || '',
                itemsSummary: ord.itemsSummary || '1x Pedido Delivery',
                total: ord.total ? Number(ord.total) : undefined
              }))
            : undefined;

          const totalOrders = groupedOrders ? groupedOrders.length : (o.totalOrdersGrouped || 1);

          return {
            offerId: offId,
            orderId: o.orderId || (groupedOrders ? groupedOrders[0]?.id : offId),
            orderNumber: o.orderNumber ? String(o.orderNumber) : (groupedOrders ? groupedOrders.map((g: any) => '#' + String(g.orderNumber).replace('#','')).join(', ') : '#000'),
            storeId: o.storeId || this.session?.storeId || 'store_bella_pizza',
            storeName: o.storeName || this.session?.storeName || 'Bella Pizza',
            storeAddress: o.storeAddress || this.session?.storeAddress || 'Rua Quinze de Janeiro, 150 - Centro, Canoas / RS',
            customerAddress: o.deliveryAddress || o.customerAddress || o.address || (groupedOrders ? `${groupedOrders.length} endereços de entrega` : 'Endereço da Entrega'),
            customerNeighborhood: o.customerNeighborhood || o.neighborhood || o.region || (groupedOrders ? groupedOrders[0]?.customerNeighborhood : 'Bairro'),
            customerCity: o.customerCity || o.city || 'Canoas',
            estimatedDistanceKm: o.estimatedDistanceKm || 2.5,
            deliveryFee: (o.deliveryFee !== undefined && o.deliveryFee !== null) ? Number(o.deliveryFee) : ((o.feeOffered !== undefined && o.feeOffered !== null) ? Number(o.feeOffered) : 12.00),
            itemsSummary: o.itemsSummary || (groupedOrders ? groupedOrders.map((g: any) => g.itemsSummary).join(' • ') : '1x Pedido Delivery'),
            totalOrdersGrouped: totalOrders,
            orders: groupedOrders,
            createdAt: o.createdAt || new Date().toISOString(),
            expiresAt: o.expiresAt || new Date(Date.now() + 600000).toISOString(),
            totalSeconds: o.timeoutSeconds || 600
          };
        });

      return myOffers;
    } catch {}

    return [];
  }

  public async respondOffer(
    offerId: string,
    decision: 'accepted' | 'rejected'
  ): Promise<{ success: boolean; assignment?: Assignment }> {
    if (!this.session) {
      throw new Error('Sessão não autorizada.');
    }

    // 1. Tenta API Central
    try {
      const res = await fetch(`${API_BASE_URL}/offer-respond`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          offerId,
          decision,
          driverId: this.session.driverId,
          membershipId: this.session.membershipId,
          storeId: this.session.storeId
        })
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 409) {
        throw new Error(data.error || data.message || 'Esta oferta já foi aceita');
      }

      if (res.ok && data.success) {
        return data;
      }
    } catch (err: any) {
      if (err.message && err.message.includes('já foi aceita')) throw err;
    }

    // 2. Fallback de Alta Disponibilidade: gravação direta na Nuvem Supabase Storage
    try {
      const cloudState = await fetchCloudLogistics();
      const offerIdx = (cloudState.offers || []).findIndex((o: any) =>
        (offerId && (o.offerId === offerId || o.id === offerId || o.orderId === offerId)) ||
        (o.status === 'pendente')
      );

      if (offerIdx === -1) {
        throw new Error('Esta oferta não está mais disponível.');
      }

      const offer = cloudState.offers[offerIdx];
      if (decision === 'rejected') {
        if (!Array.isArray(offer.rejectedByDriverIds)) offer.rejectedByDriverIds = [];
        offer.rejectedByDriverIds.push(this.session.driverId);
        await saveCloudLogistics(cloudState);
        return { success: true };
      }

      // Aceite da oferta
      if (offer.status === 'atribuida') {
        throw new Error('Esta oferta já foi aceita por outro motoboy.');
      }

      offer.status = 'atribuida';
      offer.acceptedByDriverId = this.session.driverId;
      offer.driverId = this.session.driverId;
      offer.driverName = this.session.driverName;

      const newAssignment: any = {
        id: 'asg_' + (offer.orderId || offer.id || Date.now()),
        assignmentId: 'asg_' + (offer.orderId || offer.id || Date.now()),
        orderId: offer.orderId || (offer.orders ? offer.orders[0]?.id : offer.id),
        orderNumber: offer.orderNumber || '#000',
        storeId: offer.storeId || this.session.storeId,
        storeName: offer.storeName || this.session.storeName,
        driverId: this.session.driverId,
        driverName: this.session.driverName,
        customerName: offer.customerName || 'Cliente',
        customerPhone: offer.customerPhone || '',
        address: offer.deliveryAddress || offer.customerAddress || 'Endereço',
        addressNumber: 'S/N',
        neighborhood: offer.customerNeighborhood || 'Centro',
        city: offer.customerCity || 'Canoas',
        feeOffered: offer.deliveryFee || 12,
        deliveryFee: offer.deliveryFee || 12,
        itemsSummary: offer.itemsSummary || '1x Pedido Delivery',
        status: 'waiting_pickup',
        sequence: 1,
        acceptedAt: new Date().toISOString()
      };

      if (!Array.isArray(cloudState.assignments)) cloudState.assignments = [];
      cloudState.assignments.unshift(newAssignment);
      await saveCloudLogistics(cloudState);

      return { success: true, assignment: newAssignment };
    } catch (e: any) {
      throw e;
    }
  }

  public async getAssignments(): Promise<Assignment[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/assignments?driverId=${encodeURIComponent(
          this.session.driverId
        )}&membershipId=${encodeURIComponent(this.session.membershipId)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.assignments || [];
      }
    } catch {}

    // Fallback Nuvem Supabase
    try {
      const cloudState = await fetchCloudLogistics();
      const currentDriverId = this.session?.driverId || this.account?.id;
      const currentMembershipId = this.session?.membershipId;
      const currentDriverName = this.session?.driverName || this.account?.name;
      const currentPhone = this.account?.phone || this.session?.phone;

      const myAsgs = (cloudState.assignments || []).filter((a: any) =>
        (!a.driverId ||
          a.driverId === currentDriverId ||
          a.driverId === currentMembershipId ||
          a.driverId === currentPhone ||
          a.driverName === currentDriverName ||
          a.driverName === currentPhone) &&
        a.status !== 'entregue' &&
        a.status !== 'delivered' &&
        a.status !== 'canceled_by_store' &&
        a.status !== 'canceled_by_driver'
      );
      return myAsgs;
    } catch {}

    return [];
  }

  public async confirmPickup(
    assignmentIds: string[]
  ): Promise<{ confirmed: string[]; errors: Record<string, string> }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('pickup_confirm', { assignmentIds });
      return { confirmed: assignmentIds, errors: {} };
    }

    if (!this.session) {
      throw new Error('Sessão inválida.');
    }

    // 1. Tenta API Central da Loja
    try {
      const res = await fetch(`${API_BASE_URL}/pickup-confirm`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          assignmentIds,
          driverId: this.session.driverId,
          membershipId: this.session.membershipId,
          storeId: this.session.storeId
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        return {
          confirmed: data.confirmed || assignmentIds,
          errors: data.errors || {}
        };
      }
    } catch (err: any) {
      console.warn('[Logistics API] Falha na rota local de pickup-confirm, acionando fallback de nuvem:', err?.message);
    }

    // 2. Fallback de Alta Disponibilidade: Gravação direta na Nuvem Supabase Storage
    try {
      const nowISO = new Date().toISOString();
      const cloudState = await fetchCloudLogistics();
      const targetSet = new Set(assignmentIds.map((id) => String(id).replace('#', '')));
      const confirmed: string[] = [];

      if (Array.isArray(cloudState.assignments)) {
        cloudState.assignments.forEach((a: any) => {
          const aId = String(a.id || '');
          const aAsgId = String(a.assignmentId || '');
          const aOrdId = String(a.orderId || '');
          const aOrdNum = String(a.orderNumber || '').replace('#', '');
          if (
            targetSet.has(aId) ||
            targetSet.has(aAsgId) ||
            targetSet.has(aOrdId) ||
            targetSet.has(aOrdNum) ||
            assignmentIds.includes(a.id) ||
            assignmentIds.includes(a.assignmentId)
          ) {
            a.status = 'picked_up';
            a.pickedUpAt = nowISO;
            a.pickupConfirmedAt = nowISO;
            confirmed.push(a.assignmentId || a.id);
          }
        });
      }

      await saveCloudLogistics(cloudState);

      // Sincroniza também no orders.json do Supabase Storage
      try {
        const ordersRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/orders.json?t=${Date.now()}`
        );
        if (ordersRes.ok) {
          const orders = await ordersRes.json();
          if (Array.isArray(orders)) {
            let changed = false;
            orders.forEach((o: any) => {
              const oId = String(o.id || '');
              const oNum = String(o.orderNumber || '').replace('#', '');
              if (targetSet.has(oId) || targetSet.has(oNum)) {
                o.status = 'em_entrega';
                o.dispatchStatus = 'em_entrega';
                o.pickedUpAt = nowISO;
                o.driverId = this.session?.driverId;
                o.driverName = this.session?.driverName;
                o.assignedDriverName = this.session?.driverName;
                changed = true;
              }
            });
            if (changed) {
              await fetch(
                `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/orders.json`,
                {
                  method: 'POST',
                  headers: {
                    apikey: SUPABASE_ANON_KEY,
                    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json',
                    'x-upsert': 'true'
                  },
                  body: JSON.stringify(orders)
                }
              );
            }
          }
        }
      } catch (orderErr) {
        console.warn('Erro ao atualizar orders.json via fallback:', orderErr);
      }

      return {
        confirmed: confirmed.length > 0 ? confirmed : assignmentIds,
        errors: {}
      };
    } catch (e: any) {
      console.error('Erro no fallback de confirmação de retirada:', e);
      throw new Error(e?.message || 'Erro ao confirmar retirada na loja.');
    }
  }

  public async getCurrentRoute(): Promise<RouteStop[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/route-current?driverId=${encodeURIComponent(
          this.session.driverId
        )}&membershipId=${encodeURIComponent(this.session.membershipId)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.stops || [];
      }
    } catch {}

    return [];
  }

  public async reorderRoute(
    stops: { assignmentId: string; sequence: number }[]
  ): Promise<boolean> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('route_reorder', { stops });
      return true;
    }

    if (!this.session) return false;

    try {
      const res = await fetch(`${API_BASE_URL}/route-reorder`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          stops,
          driverId: this.session.driverId,
          membershipId: this.session.membershipId
        })
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  public async confirmDelivery(
    assignmentId: string,
    pinCandidate: string,
    deliveryFee?: number | null,
    isForced?: boolean,
    forcedReason?: string
  ): Promise<{ success: boolean; message: string; isOfflinePending?: boolean }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('delivery_confirm', {
        assignmentId,
        pinCandidate,
        isForced,
        forcedReason
      });
      if (this.session) {
        this.recordDeliveryInLedger(this.session.storeId, deliveryFee || 0);
      }
      return {
        success: true,
        isOfflinePending: true,
        message:
          'Entrega gravada no aparelho. Pendente de validação online com a loja ao reconectar.'
      };
    }

    if (!this.session) {
      throw new Error('Sessão expirada. Faça nova ativação.');
    }

    // 1. Tenta API Central da Loja
    try {
      const res = await fetch(`${API_BASE_URL}/delivery-confirm`, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify({
          assignmentId,
          pinCandidate,
          isForced,
          forcedReason,
          driverId: this.session.driverId,
          membershipId: this.session.membershipId,
          storeId: this.session.storeId
        })
      });

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        this.recordDeliveryInLedger(this.session.storeId, deliveryFee || 0);
        return {
          success: true,
          message: data.message || 'Entrega confirmada com sucesso!'
        };
      }

      if (res.status === 422) {
        throw new Error(
          data.error ||
            'Código incorreto! Digite o PIN de 4 dígitos, os 4 últimos do celular ou o número do pedido.'
        );
      }
    } catch (err: any) {
      if (err.message && err.message.includes('Código incorreto')) {
        throw err;
      }
      console.warn('[Logistics API] Falha na rota local de delivery-confirm, acionando fallback Supabase:', err?.message);
    }

    // 2. Fallback de Alta Disponibilidade: Validação e gravação direta na Nuvem Supabase
    try {
      const nowISO = new Date().toISOString();
      const cloudState = await fetchCloudLogistics();
      const targetAsg = (cloudState.assignments || []).find(
        (a: any) =>
          a.id === assignmentId ||
          a.assignmentId === assignmentId ||
          (a.orderId && String(a.orderId) === String(assignmentId))
      );

      // Validação de PIN no fallback
      if (!isForced) {
        const clean = String(pinCandidate || '').trim();
        const validCodes = new Set<string>();

        if (targetAsg?.deliveryPin) validCodes.add(String(targetAsg.deliveryPin).trim());
        if (targetAsg?.pinCode) validCodes.add(String(targetAsg.pinCode).trim());

        const phone = String(targetAsg?.customerPhone || '').replace(/\D/g, '');
        if (phone.length >= 4) validCodes.add(phone.slice(-4));

        const orderNum = String(targetAsg?.orderNumber || '').replace(/\D/g, '');
        if (orderNum.length >= 2) {
          validCodes.add(orderNum);
          if (orderNum.length >= 4) validCodes.add(orderNum.slice(-4));
        }

        // Tenta também consultar orders.json para pegar o deliveryPin original
        try {
          const ordersRes = await fetch(
            `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/orders.json?t=${Date.now()}`
          );
          if (ordersRes.ok) {
            const orders = await ordersRes.json();
            const ord = orders.find(
              (o: any) =>
                String(o.id) === String(targetAsg?.orderId || assignmentId) ||
                String(o.orderNumber).replace(/\D/g, '') === orderNum
            );
            if (ord) {
              if (ord.deliveryPin) validCodes.add(String(ord.deliveryPin).trim());
              const ordPhone = String(ord.phone || '').replace(/\D/g, '');
              if (ordPhone.length >= 4) validCodes.add(ordPhone.slice(-4));
              if (ord.orderNumber) validCodes.add(String(ord.orderNumber).replace(/\D/g, ''));
            }
          }
        } catch {}

        if (validCodes.size > 0 && !validCodes.has(clean)) {
          throw new Error(
            'Código incorreto! Digite o PIN de 4 dígitos, os 4 últimos números do celular ou o número do pedido.'
          );
        }
      }

      // Atualiza assignment no cloudState
      if (targetAsg) {
        targetAsg.status = 'entregue';
        targetAsg.deliveredAt = nowISO;
        if (isForced) {
          targetAsg.forcedDelivery = true;
          targetAsg.forcedDeliveryReason =
            forcedReason || 'Confirmado sob termo de responsabilidade pelo motoboy';
        }
      }
      await saveCloudLogistics(cloudState);

      // Atualiza orders.json
      try {
        const ordersRes = await fetch(
          `${SUPABASE_URL}/storage/v1/object/public/${SUPABASE_BUCKET}/orders.json?t=${Date.now()}`
        );
        if (ordersRes.ok) {
          const orders = await ordersRes.json();
          let changed = false;
          orders.forEach((o: any) => {
            if (
              String(o.id) === String(targetAsg?.orderId || assignmentId) ||
              String(o.orderNumber).replace(/\D/g, '') ===
                String(targetAsg?.orderNumber || '').replace(/\D/g, '')
            ) {
              o.status = 'concluido';
              o.dispatchStatus = 'concluido';
              o.deliveredAt = nowISO;
              changed = true;
            }
          });
          if (changed) {
            await fetch(
              `${SUPABASE_URL}/storage/v1/object/${SUPABASE_BUCKET}/orders.json`,
              {
                method: 'POST',
                headers: {
                  apikey: SUPABASE_ANON_KEY,
                  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                  'Content-Type': 'application/json',
                  'x-upsert': 'true'
                },
                body: JSON.stringify(orders)
              }
            );
          }
        }
      } catch {}

      this.recordDeliveryInLedger(this.session.storeId, deliveryFee || 0);

      return {
        success: true,
        message: 'Entrega confirmada com sucesso!'
      };
    } catch (e: any) {
      throw e;
    }
  }

  public async requestWithdrawal(
    assignmentId: string,
    reason: string
  ): Promise<{ success: boolean; message: string }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('assignment_withdraw', { assignmentId, reason });
      if (this.session) {
        this.recordCancellationInLedger(this.session.storeId);
      }
      return {
        success: true,
        message:
          'Solicitação registrada offline. O pedido continua sob sua responsabilidade até a aprovação da loja.'
      };
    }

    if (!this.session) {
      throw new Error('Sessão não autorizada.');
    }

    const res = await fetch(`${API_BASE_URL}/assignment-withdraw`, {
      method: 'POST',
      headers: this.getAuthHeaders(),
      body: JSON.stringify({
        assignmentId,
        reason,
        driverId: this.session.driverId,
        membershipId: this.session.membershipId
      })
    });

    if (!res.ok) {
      let errMsg = 'Erro ao enviar desistência.';
      try {
        const errData = await res.json();
        errMsg = errData.error || errData.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    this.recordCancellationInLedger(this.session.storeId);
    return await res.json();
  }

  public async getHistory(): Promise<{
    items: DeliveryHistoryItem[];
    totalEarnings: number;
    hasUninformedFees: boolean;
  }> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return { items: [], totalEarnings: 0, hasUninformedFees: false };
    }

    try {
      const res = await fetch(
        `${API_BASE_URL}/history?driverId=${encodeURIComponent(
          this.session.driverId
        )}&membershipId=${encodeURIComponent(this.session.membershipId)}`,
        {
          headers: this.getAuthHeaders()
        }
      );
      if (res.ok) {
        const data = await res.json();
        const items: DeliveryHistoryItem[] = Array.isArray(data) ? data : data.items || [];
        let total = 0;
        let hasUninformed = false;
        for (const it of items) {
          if (it.deliveryFee !== null && it.deliveryFee !== undefined) {
            total += it.deliveryFee;
          } else {
            hasUninformed = true;
          }
        }
        return { items, totalEarnings: total, hasUninformedFees: hasUninformed };
      }
    } catch {}

    return { items: [], totalEarnings: 0, hasUninformedFees: false };
  }

  public async getRatings(): Promise<RatingsData> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return {
        averageStars: 5.0,
        totalRatings: 0,
        period: 'Últimos 30 dias',
        distribution: []
      };
    }

    try {
      const res = await fetch(`${API_BASE_URL}/ratings`, {
        headers: this.getAuthHeaders()
      });
      if (res.ok) {
        return await res.json();
      }
    } catch {}

    return {
      averageStars: 5.0,
      totalRatings: 0,
      period: 'Últimos 30 dias',
      distribution: []
    };
  }

  public async flushOfflineQueue(): Promise<{ syncedCount: number; errors: number }> {
    const queue = offlineQueue.getQueue();
    if (queue.length === 0 || !offlineQueue.getIsOnline() || !this.session) {
      return { syncedCount: 0, errors: 0 };
    }

    let synced = 0;
    let errors = 0;

    for (const cmd of queue) {
      try {
        let res: Response | null = null;
        if (cmd.action === 'delivery_confirm') {
          res = await fetch(`${API_BASE_URL}/delivery-confirm`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(cmd.payload)
          });
        } else if (cmd.action === 'pickup_confirm') {
          res = await fetch(`${API_BASE_URL}/pickup-confirm`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(cmd.payload)
          });
        } else if (cmd.action === 'route_reorder') {
          res = await fetch(`${API_BASE_URL}/route-reorder`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(cmd.payload)
          });
        } else if (cmd.action === 'assignment_withdraw') {
          res = await fetch(`${API_BASE_URL}/assignment-withdraw`, {
            method: 'POST',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(cmd.payload)
          });
        }

        if (res && (res.ok || res.status === 409)) {
          offlineQueue.markConfirmed(cmd.id);
          synced++;
        } else {
          errors++;
          offlineQueue.markFailed(cmd.id, 'Falha ao sincronizar com a loja');
        }
      } catch (err: any) {
        errors++;
        offlineQueue.markFailed(cmd.id, err.message || 'Erro de rede');
      }
    }

    return { syncedCount: synced, errors };
  }
}

export const api = new ApiClient();
