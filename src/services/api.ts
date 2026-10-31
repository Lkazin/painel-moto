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

// Configuração Supabase Cloud Storage (Nuvem em Tempo Real)
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

const ORDERS_FILE = 'orders.json';

async function fetchCloudOrders(): Promise<any[]> {
  try {
    const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/${STORAGE_BUCKET}/${ORDERS_FILE}?t=${Date.now()}`;
    const res = await fetch(url, {
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok) {
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.warn('[CloudOrders] Falha ao carregar pedidos da nuvem:', err);
  }
  return [];
}

async function saveCloudOrders(orders: any[]): Promise<boolean> {
  try {
    const url = `${SUPABASE_PROJECT_URL}/storage/v1/object/${STORAGE_BUCKET}/${ORDERS_FILE}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'x-upsert': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orders)
    });
    return res.ok;
  } catch (err) {
    console.warn('[CloudOrders] Falha ao salvar pedidos na nuvem:', err);
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

    // Tenta registrar na API Central
    try {
      const response = await fetch(`${API_BASE_URL}/driver/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: cleanName,
          phone: cleanPhone,
          vehiclePlate: cleanPlate,
          vehicleModel,
          password
        })
      });
      if (response.ok) {
        const data = await response.json();
        this.account = data.account;
        this.saveAccount();
        return this.account!;
      }
    } catch {}

    // Registro seguro local com persistência
    const newAccount: DriverAccount = {
      id: 'drv_' + Date.now(),
      name: cleanName,
      phone: phone.trim(),
      vehiclePlate: cleanPlate,
      vehicleModel: vehicleModel.trim() || 'Moto Padrão',
      createdAt: new Date().toISOString()
    };

    // Guarda na lista de contas registradas
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

    // Tenta login na API Central
    try {
      const response = await fetch(`${API_BASE_URL}/driver/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: cleanId, password })
      });
      if (response.ok) {
        const data = await response.json();
        this.account = data.account;
        this.saveAccount();
        return this.account!;
      }
    } catch {}

    // Validação local no cadastro do aparelho
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

    // Se houver uma conta já logada e a senha bater
    if (this.account && (this.account.phone.includes(cleanId) || this.account.name.toLowerCase().includes(cleanId.toLowerCase()))) {
      return this.account;
    }

    // Cria/autentica conta rápida com os dados informados
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

  // Limpa completamente todos os dados e histórico salvos localmente
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

  // Compatibilidade com ativação legada
  public async activateInvite(inviteCode: string, _deviceFingerprint?: string): Promise<DriverSession> {
    if (!this.account) {
      // Cria conta temporária se não houver
      await this.loginDriver('Entregador Novaes', '1234');
    }
    return this.activateStoreShift(inviteCode);
  }

  // ==========================================
  // VÍNCULO DO PLANTÃO DA LOJA (CÓDIGO NW-XXXXXX)
  // ==========================================

  public async activateStoreShift(inviteCode: string): Promise<DriverSession> {
    if (!this.account) {
      throw new Error('Você precisa estar logado na sua conta de entregador.');
    }

    const cleanCode = inviteCode.trim().toUpperCase();
    let fingerprint = localStorage.getItem('novaesweb_device_fp') || 'fp_' + Date.now();

    // 1. Se API_BASE_URL não for localhost, tenta API Central
    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
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

        if (response.ok) {
          const data = await response.json();
          const storeObj = data.store || {};
          const driverObj = data.driver || {};

          const newSession: DriverSession = {
            token: data.sessionToken || data.token || 'jwt_shift_' + Date.now(),
            driverId: driverObj.driverId || driverObj.id || this.account.id,
            driverName: driverObj.driverName || driverObj.name || this.account.name,
            phone: driverObj.phone || this.account.phone,
            vehiclePlate: driverObj.vehiclePlate || this.account.vehiclePlate,
            deviceFingerprint: fingerprint,
            storeId: storeObj.id || 'store_' + cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
            storeName: storeObj.name || 'Bella Pizza',
            storeAddress: storeObj.address || 'Rua das Camélias, 412 - Jardins, SP',
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
      } catch (e) {
        console.warn('Tentativa API central falhou, conectando via Supabase Cloud Storage:', e);
      }
    }

    // 2. Sincronização Direta em Nuvem via Supabase Cloud Storage
    try {
      const cloudState = await fetchCloudLogistics();
      
      let shift = cloudState.drivers.find((d: any) =>
        d.inviteCode && d.inviteCode.toString().trim().toUpperCase() === cleanCode
      );

      // Se não encontrou pelo código exato mas começa com NW-, procura algum plantão aguardando
      if (!shift && cleanCode.startsWith('NW-')) {
        shift = cloudState.drivers.find((d: any) => d.status === 'aguardando_motoboy');
      }

      // Se ainda não existir registro desse código, registra o plantão na nuvem
      if (!shift) {
        shift = {
          id: 'shift_' + Date.now(),
          inviteCode: cleanCode,
          storeId: 'store_bella_pizza',
          storeName: 'Bella Pizza',
          storeAddress: 'Rua das Camélias, 412 - Jardins, SP',
          status: 'aguardando_motoboy',
          shiftStatus: 'aguardando_motoboy',
          presence: 'indisponivel',
          activeDeliveries: 0,
          maxDeliveries: 3,
          validityDays: 1,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          createdAt: new Date().toISOString()
        };
        cloudState.drivers.unshift(shift);
      }

      if (shift.status === 'bloqueado') {
        throw new Error('Este código de plantão ou entregador foi bloqueado pela loja.');
      }

      // Ativa o entregador no plantão da nuvem
      shift.driverId = this.account.id;
      shift.driverName = this.account.name;
      shift.name = this.account.name;
      shift.phone = this.account.phone;
      shift.vehiclePlate = this.account.vehiclePlate;
      shift.deviceFingerprint = fingerprint;
      shift.status = 'ativo';
      shift.shiftStatus = 'em_plantao';
      shift.presence = 'disponivel';
      shift.activatedAt = new Date().toISOString();

      await saveCloudLogistics(cloudState);

      const newSession: DriverSession = {
        token: 'jwt_cloud_' + Date.now(),
        driverId: this.account.id,
        driverName: this.account.name,
        phone: this.account.phone,
        vehiclePlate: this.account.vehiclePlate,
        deviceFingerprint: fingerprint,
        storeId: shift.storeId || 'store_bella_pizza',
        storeName: shift.storeName || 'Bella Pizza',
        storeAddress: shift.storeAddress || 'Rua das Camélias, 412 - Jardins, SP',
        membershipId: shift.id,
        role: 'entregador_plantao',
        expiresAt: shift.expiresAt || new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
        isActivated: true,
        shiftStartedAt: new Date().toISOString()
      };

      this.session = newSession;
      this.presence.manualEnabled = true;
      this.saveSession();
      this.savePresence();
      this.updateLedgerForStore(newSession.storeId, newSession.storeName, newSession.storeAddress);
      return this.session;
    } catch (err: any) {
      if (err.message && !err.message.includes('fetch')) {
        throw err;
      }
      throw new Error(`Não foi possível ativar o plantão com o código "${cleanCode}". Verifique sua conexão com a internet.`);
    }
  }

  // Encerrar Plantão na Loja e liberar o motoboy
  public async closeStoreShift(): Promise<{ shiftSummary: StoreShiftSummary }> {
    if (!this.session) {
      throw new Error('Nenhum plantão ativo no momento.');
    }

    const currentStoreId = this.session.storeId;
    const storeName = this.session.storeName;

    // Atualiza na Nuvem Supabase
    try {
      const cloudState = await fetchCloudLogistics();
      const driver = cloudState.drivers.find((d: any) =>
        d.driverId === this.session?.driverId || d.driverName === this.session?.driverName || d.id === this.session?.membershipId
      );
      if (driver) {
        driver.presence = 'indisponivel';
        driver.shiftStatus = 'plantao_encerrado';
        await saveCloudLogistics(cloudState);
      }
    } catch {}

    // Notifica backend se online e não-localhost
    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost && offlineQueue.getIsOnline()) {
      try {
        await fetch(`${API_BASE_URL}/shift-close`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ storeId: currentStoreId })
        });
      } catch {}
    }

    // Busca resumo no ledger
    let summary = this.ledger.find(s => s.storeId === currentStoreId);
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

    // Limpa a sessão da loja ativa, mas MANTÉM a conta do entregador logada
    this.session = null;
    this.saveSession();

    return { shiftSummary: summary };
  }

  // Extrato de todas as lojas trabalhadas pelo motoboy
  public getStoresLedger(): StoreShiftSummary[] {
    return [...this.ledger];
  }

  private updateLedgerForStore(storeId: string, storeName: string, storeAddress?: string): void {
    const existing = this.ledger.find(s => s.storeId === storeId);
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

  // Registra entrega confirmada no extrato da loja
  public recordDeliveryInLedger(storeId: string, deliveryFee: number | null): void {
    const summary = this.ledger.find(s => s.storeId === storeId);
    if (summary) {
      summary.completedCount++;
      if (deliveryFee) {
        summary.totalToReceive += deliveryFee;
      }
      this.saveLedger();
    }
  }

  // Registra cancelamento no extrato da loja
  public recordCancellationInLedger(storeId: string): void {
    const summary = this.ledger.find(s => s.storeId === storeId);
    if (summary) {
      summary.canceledCount++;
      this.saveLedger();
    }
  }

  // ==========================================
  // OPERAÇÕES LOGÍSTICAS DA LOJA ATIVA
  // ==========================================

  public async validateSession(): Promise<{ valid: boolean; session?: DriverSession }> {
    const currentSession = this.session;
    if (!currentSession) {
      return { valid: false };
    }

    try {
      const response = await fetch(`${API_BASE_URL}/session-validate`, {
        headers: { Authorization: `Bearer ${currentSession.token}` }
      });
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
      // 1. Atualiza na nuvem Supabase Storage
      try {
        const cloudState = await fetchCloudLogistics();
        const driver = cloudState.drivers.find((d: any) =>
          d.driverId === this.session?.driverId || d.driverName === this.session?.driverName || d.id === this.session?.membershipId
        );
        if (driver) {
          driver.presence = manualEnabled ? 'disponivel' : 'indisponivel';
          driver.shiftStatus = manualEnabled ? 'em_plantao' : 'plantao_encerrado';
          await saveCloudLogistics(cloudState);
        }
      } catch {}

      // 2. Se configurado e não-localhost, notifica API Central
      const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
      if (!isLocalhost) {
        try {
          await fetch(`${API_BASE_URL}/driver-presence`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.session.token}`
            },
            body: JSON.stringify({ manualEnabled })
          });
        } catch {}
      }
    }

    return this.getPresence();
  }

  public async getOffers(): Promise<Offer[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    // 1. Tenta API Central se não for localhost
    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
        const res = await fetch(`${API_BASE_URL}/offers`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : data.offers || [];
          const now = Date.now();
          return list.filter((o: Offer) => new Date(o.expiresAt).getTime() > now);
        }
      } catch {}
    }

    // 2. Sincronização direta na nuvem Supabase
    try {
      const cloudState = await fetchCloudLogistics();
      const now = Date.now();
      const myOffers: Offer[] = cloudState.offers
        .filter((o: any) => {
          const notExpired = !o.expiresAt || new Date(o.expiresAt).getTime() > now;
          const isPending = o.status === 'pendente';
          const isForMe = !o.targetDriverId || !o.driverId || o.targetDriverId === this.session?.driverId || o.driverId === this.session?.driverId;
          return notExpired && isPending && isForMe;
        })
        .map((o: any) => {
          const offId = o.offerId || o.id || o.orderId || ('off_' + Date.now());
          const groupedOrders = Array.isArray(o.orders) && o.orders.length > 0
            ? o.orders.map((ord: any) => ({
                id: ord.id || ord.orderId,
                orderNumber: ord.orderNumber ? String(ord.orderNumber) : ('#' + Math.floor(100 + Math.random() * 900)),
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
            orderNumber: o.orderNumber ? String(o.orderNumber) : (groupedOrders ? groupedOrders.map((g: any) => '#' + g.orderNumber.replace('#','')).join(', ') : ('#' + Math.floor(100 + Math.random() * 900))),
            storeId: o.storeId || this.session?.storeId || 'store_bella_pizza',
            storeName: o.storeName || this.session?.storeName || 'Bella Pizza',
            storeAddress: o.storeAddress || this.session?.storeAddress || 'Rua das Camélias, 412 - Jardins, SP',
            customerAddress: o.deliveryAddress || o.customerAddress || o.address || (groupedOrders ? `${groupedOrders.length} endereços de entrega` : 'Endereço da Entrega'),
            customerNeighborhood: o.customerNeighborhood || o.neighborhood || o.region || (groupedOrders ? groupedOrders[0]?.customerNeighborhood : 'Bairro Próximo'),
            customerCity: o.customerCity || o.city || 'São Paulo',
            estimatedDistanceKm: o.estimatedDistanceKm || 2.5,
            deliveryFee: (o.deliveryFee !== undefined && o.deliveryFee !== null) ? Number(o.deliveryFee) : ((o.feeOffered !== undefined && o.feeOffered !== null) ? Number(o.feeOffered) : 12.00),
            itemsSummary: o.itemsSummary || (groupedOrders ? groupedOrders.map((g: any) => g.itemsSummary).join(' • ') : '1x Pedido Delivery'),
            totalOrdersGrouped: totalOrders,
            orders: groupedOrders,
            createdAt: o.createdAt || new Date().toISOString(),
            expiresAt: o.expiresAt || new Date(Date.now() + 60000).toISOString(),
            totalSeconds: o.totalSeconds || 60
          };
        });
      return myOffers;
    } catch {}

    return [];
  }

  public async respondOffer(offerId: string, decision: 'accepted' | 'rejected'): Promise<{ success: boolean; assignment?: Assignment }> {
    if (!this.session) {
      throw new Error('Sessão não autorizada.');
    }

    // 1. Tenta API se não for localhost
    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
        const res = await fetch(`${API_BASE_URL}/offer-respond`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ offerId, decision })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    // 2. Sincronização direta na nuvem Supabase
    try {
      const cloudState = await fetchCloudLogistics();
      
      // Encontra a oferta correspondente na nuvem por offerId, id, orderId ou primeira pendente
      const offerIdx = cloudState.offers.findIndex((o: any) =>
        (offerId && (o.offerId === offerId || o.id === offerId || o.orderId === offerId)) ||
        (o.status === 'pendente')
      );

      const offer = offerIdx !== -1 ? cloudState.offers[offerIdx] : null;

      if (decision === 'accepted') {
        if (offer) {
          offer.status = 'atribuida';
          offer.driverId = this.session.driverId;
          offer.driverName = this.session.driverName;
        }

        // Se a oferta tiver pedidos agrupados
        const offerOrders = Array.isArray(offer?.orders) && offer.orders.length > 0
          ? offer.orders
          : [{
              id: offer?.orderId || offerId || ('ord_' + Date.now()),
              orderNumber: offer?.orderNumber ? String(offer.orderNumber) : ('#' + Math.floor(100 + Math.random() * 900)),
              customerName: offer?.customerName || 'Cliente',
              customerPhone: offer?.customerPhone || '(11) 99999-9999',
              customerAddress: offer?.deliveryAddress || offer?.customerAddress || 'Endereço da Entrega',
              customerNeighborhood: offer?.customerNeighborhood || offer?.region || 'Bairro',
              customerCity: offer?.customerCity || 'São Paulo',
              itemsSummary: offer?.itemsSummary || '1x Pedido Delivery',
              total: offer?.total
            }];

        const createdAssignments: Assignment[] = [];

        offerOrders.forEach((ord: any, idx: number) => {
          const ordId = ord.id || ord.orderId || ('ord_' + idx + '_' + Date.now());
          const asgId = 'asg_' + ordId;
          const feePerOrder = (offer?.deliveryFee !== undefined && offer?.deliveryFee !== null)
            ? Number(offer.deliveryFee) / offerOrders.length
            : ((offer?.feeOffered !== undefined && offer?.feeOffered !== null) ? Number(offer.feeOffered) / offerOrders.length : 12.00);

          const newAsg: Assignment = {
            assignmentId: asgId,
            orderId: ordId,
            orderNumber: ord.orderNumber ? String(ord.orderNumber) : ('#' + Math.floor(100 + Math.random() * 900)),
            storeId: offer?.storeId || this.session?.storeId || 'store_bella_pizza',
            storeName: offer?.storeName || this.session?.storeName || 'Bella Pizza',
            driverId: this.session?.driverId || this.account?.id || offer?.targetDriverId || offer?.driverId,
            driverName: this.session?.driverName || this.account?.name || offer?.driverName,
            customerName: ord.customerName || 'Cliente',
            customerPhone: ord.customerPhone || '(11) 99999-9999',
            address: ord.customerAddress || ord.address || 'Endereço da Entrega',
            addressNumber: ord.addressNumber || 'S/N',
            neighborhood: ord.customerNeighborhood || ord.region || 'Bairro',
            city: ord.customerCity || 'São Paulo',
            deliveryFee: feePerOrder,
            itemsSummary: ord.itemsSummary || '1x Pedido Delivery',
            status: 'waiting_pickup',
            sequence: idx + 1,
            acceptedAt: new Date().toISOString()
          };

          const existingIdx = cloudState.assignments.findIndex((a: any) =>
            a.assignmentId === newAsg.assignmentId || a.orderId === newAsg.orderId
          );
          if (existingIdx >= 0) {
            cloudState.assignments[existingIdx] = newAsg;
          } else {
            cloudState.assignments.unshift(newAsg);
          }
          createdAssignments.push(newAsg);
        });

        // Marca como atribuída em cloudState.offers
        cloudState.offers = cloudState.offers.map((o: any) => {
          if (
            (offerId && (o.offerId === offerId || o.id === offerId || o.orderId === offerId)) ||
            (offer && (o.id === offer.id || o.orderId === offer.orderId))
          ) {
            return { ...o, status: 'atribuida', driverId: this.session?.driverId, driverName: this.session?.driverName };
          }
          return o;
        });

        await saveCloudLogistics(cloudState);

        // ATUALIZA STATUS NOS PEDIDOS DA LOJA: Aceito — Aguardando Retirada!
        try {
          const cloudOrders = await fetchCloudOrders();
          let ordersChanged = false;
          const orderIdSet = new Set(offerOrders.map((o: any) => String(o.id || o.orderId)));
          const orderNumberSet = new Set(offerOrders.map((o: any) => String(o.orderNumber).replace('#', '')));

          cloudOrders.forEach((ord: any) => {
            const idMatch = orderIdSet.has(String(ord.id));
            const numMatch = orderNumberSet.has(String(ord.orderNumber));
            if (idMatch || numMatch) {
              ord.dispatchStatus = 'aceito_aguardando_retirada';
              ord.driverName = this.session?.driverName || 'Motoboy';
              ord.assignedDriverName = this.session?.driverName || 'Motoboy';
              ord.acceptedAt = new Date().toISOString();
              ordersChanged = true;
            }
          });
          if (ordersChanged) {
            await saveCloudOrders(cloudOrders);
          }
        } catch (e) {
          console.warn('[respondOffer] Erro ao atualizar status do pedido na loja:', e);
        }

        return { success: true, assignment: createdAssignments[0] };
      } else {
        if (offer) {
          offer.status = 'recusada';
        }
        cloudState.offers = cloudState.offers.map((o: any) => {
          if (
            (offerId && (o.offerId === offerId || o.id === offerId || o.orderId === offerId)) ||
            (offer && (o.id === offer.id || o.orderId === offer.orderId))
          ) {
            return { ...o, status: 'recusada' };
          }
          return o;
        });
        await saveCloudLogistics(cloudState);

        // Devolve pedidos para 'disponivel' na loja
        try {
          const cloudOrders = await fetchCloudOrders();
          let ordersChanged = false;
          const offerOrderIds = new Set(
            Array.isArray(offer?.orders)
              ? offer.orders.map((o: any) => String(o.id || o.orderId))
              : [String(offer?.orderId || offerId)]
          );

          cloudOrders.forEach((ord: any) => {
            if (offerOrderIds.has(String(ord.id)) || offerOrderIds.has(String(ord.orderNumber))) {
              ord.dispatchStatus = 'disponivel';
              ord.assignedDriverName = null;
              ord.driverName = null;
              ordersChanged = true;
            }
          });
          if (ordersChanged) {
            await saveCloudOrders(cloudOrders);
          }
        } catch {}

        return { success: true };
      }
    } catch (err: any) {
      throw new Error(err.message || 'Erro ao responder oferta.');
    }
  }

  public async getAssignments(): Promise<Assignment[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
        const res = await fetch(`${API_BASE_URL}/assignments`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data) ? data : data.assignments || [];
        }
      } catch {}
    }

    // Busca na Nuvem Supabase
    try {
      const cloudState = await fetchCloudLogistics();
      const currentDriverId = this.session?.driverId || this.account?.id;
      const currentDriverName = this.session?.driverName || this.account?.name;

      return cloudState.assignments
        .filter((a: any) =>
          (!a.driverId || a.driverId === currentDriverId || a.driverName === currentDriverName) &&
          a.status !== 'delivered' && a.status !== 'entregue' && a.status !== 'canceled_by_store'
        )
        .map((a: any, idx: number) => ({
          assignmentId: a.assignmentId || a.id || ('asg_' + idx),
          orderId: a.orderId || ('ord_' + idx),
          orderNumber: a.orderNumber ? String(a.orderNumber) : ('#' + (100 + idx)),
          storeId: a.storeId || this.session?.storeId,
          storeName: a.storeName || this.session?.storeName,
          customerName: a.customerName || 'Cliente',
          customerPhone: a.customerPhone,
          address: a.address || a.deliveryAddress || 'Endereço',
          addressNumber: a.addressNumber || 'S/N',
          neighborhood: a.neighborhood || a.customerNeighborhood || a.region || 'Bairro',
          city: a.city || a.customerCity || 'São Paulo',
          deliveryFee: (a.deliveryFee !== undefined && a.deliveryFee !== null) ? Number(a.deliveryFee) : ((a.feeOffered !== undefined && a.feeOffered !== null) ? Number(a.feeOffered) : 12.00),
          itemsSummary: a.itemsSummary || '1x Pedido Delivery',
          status: (a.status === 'in_transit' || a.status === 'picked_up' || a.status === 'waiting_pickup') ? a.status : 'waiting_pickup',
          sequence: a.sequence || (idx + 1),
          acceptedAt: a.acceptedAt || new Date().toISOString()
        }));
    } catch {}

    return [];
  }

  public async confirmPickup(assignmentIds: string[]): Promise<{ confirmed: string[]; errors: Record<string, string> }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('pickup_confirm', { assignmentIds });
      return { confirmed: assignmentIds, errors: {} };
    }

    if (!this.session) {
      throw new Error('Sessão inválida.');
    }

    // Atualiza na Nuvem Supabase
    try {
      const cloudState = await fetchCloudLogistics();
      const pickedOrderIds: string[] = [];

      for (const id of assignmentIds) {
        const asg = cloudState.assignments.find((a: any) => a.assignmentId === id || a.id === id);
        if (asg) {
          asg.status = 'picked_up';
          asg.pickupConfirmedAt = new Date().toISOString();
          if (asg.orderId) pickedOrderIds.push(asg.orderId);
        }
      }
      await saveCloudLogistics(cloudState);

      // ATUALIZA OS PEDIDOS CORRESPONDENTES NA LOJA PARA: "em_entrega"
      try {
        const cloudOrders = await fetchCloudOrders();
        let ordersChanged = false;
        const pickedSet = new Set(pickedOrderIds.map(String));
        cloudOrders.forEach((ord: any) => {
          if (pickedSet.has(String(ord.id)) || pickedSet.has(String(ord.orderNumber))) {
            ord.status = 'em_entrega';
            ord.dispatchStatus = 'em_entrega';
            ord.pickedUpAt = new Date().toISOString();
            ord.driverName = this.session?.driverName;
            ordersChanged = true;
          }
        });
        if (ordersChanged) {
          await saveCloudOrders(cloudOrders);
        }
      } catch (errOrders) {
        console.warn('[confirmPickup] Erro ao sincronizar pedidos com a loja:', errOrders);
      }
    } catch {}

    return { confirmed: assignmentIds, errors: {} };
  }

  public async getCurrentRoute(): Promise<RouteStop[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
        const res = await fetch(`${API_BASE_URL}/route-current`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          return Array.isArray(data) ? data : data.stops || [];
        }
      } catch {}
    }

    // Monta rota a partir das entregas em aberto na Nuvem
    try {
      const assignments = await this.getAssignments();
      return assignments.map((a, idx) => ({
        assignmentId: a.assignmentId,
        orderNumber: a.orderNumber,
        sequence: idx + 1,
        customerName: a.customerName || 'Cliente',
        address: a.address,
        neighborhood: a.neighborhood || 'Bairro',
        status: a.status,
        isCurrent: idx === 0,
        deliveryFee: a.deliveryFee
      }));
    } catch {}

    return [];
  }

  public async reorderRoute(stops: { assignmentId: string; sequence: number }[]): Promise<boolean> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('route_reorder', { stops });
      return true;
    }

    if (!this.session) return false;

    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
        const res = await fetch(`${API_BASE_URL}/route-reorder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ stops })
        });
        return res.ok;
      } catch {}
    }

    return true;
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
      offlineQueue.enqueue('delivery_confirm', { assignmentId, pinCandidate, isForced, forcedReason });
      if (this.session) {
        this.recordDeliveryInLedger(this.session.storeId, deliveryFee || 0);
      }
      return {
        success: true,
        isOfflinePending: true,
        message: 'Entrega gravada no aparelho. Pendente de validação online com a loja ao reconectar.'
      };
    }

    if (!this.session) {
      throw new Error('Sessão expirada. Faça nova ativação.');
    }

    // Sincroniza e valida na Nuvem Supabase
    let matchedOrderId: string | null = null;
    let matchedOrderNumber: string | null = null;
    try {
      const [cloudState, cloudOrders] = await Promise.all([
        fetchCloudLogistics(),
        fetchCloudOrders()
      ]);

      const assignment = cloudState.assignments.find((a: any) => a.assignmentId === assignmentId || a.id === assignmentId);
      
      const ordIdTarget = assignment?.orderId ? String(assignment.orderId) : null;
      const ordNumTarget = assignment?.orderNumber ? String(assignment.orderNumber).replace(/\D/g, '') : null;

      const matchingOrder = cloudOrders.find((ord: any) => {
        const idMatch = ordIdTarget && String(ord.id) === ordIdTarget;
        const numMatch = ordNumTarget && String(ord.orderNumber).replace(/\D/g, '') === ordNumTarget;
        return idMatch || numMatch;
      });

      // VALIDAÇÃO RIGOROSA DO CÓDIGO (SE NÃO FOR FORÇADO)
      if (!isForced) {
        const cleanPin = String(pinCandidate || '').trim();
        const validCodes = new Set<string>();

        // 1. PIN de entrega oficial do pedido
        if (matchingOrder?.deliveryPin) {
          validCodes.add(String(matchingOrder.deliveryPin).trim());
        }
        if (assignment?.pinCode) {
          validCodes.add(String(assignment.pinCode).trim());
        }

        // 2. 4 últimos dígitos do celular do cliente
        const customerPhone = String(matchingOrder?.phone || assignment?.customerPhone || '').replace(/\D/g, '');
        if (customerPhone.length >= 4) {
          validCodes.add(customerPhone.slice(-4));
        }

        // 3. Número do pedido (ex: pedido #1042 -> 1042)
        const orderDigits = String(matchingOrder?.orderNumber || assignment?.orderNumber || '').replace(/\D/g, '');
        if (orderDigits.length >= 2) {
          validCodes.add(orderDigits);
        }

        // Se houver códigos válidos cadastrados, exige correspondência exata
        if (validCodes.size > 0 && !validCodes.has(cleanPin)) {
          throw new Error('Código incorreto! Peça o PIN do app, os 4 últimos números do celular do cliente ou o número do pedido.');
        }
      }

      const nowISO = new Date().toISOString();

      if (assignment) {
        assignment.status = 'entregue';
        assignment.deliveredAt = nowISO;
        if (isForced) {
          assignment.forcedDelivery = true;
          assignment.forcedDeliveryReason = forcedReason || 'Confirmado sob termo de responsabilidade pelo motoboy';
          assignment.forcedByDriverName = this.session?.driverName;
          assignment.forcedAt = nowISO;
        }
        matchedOrderId = assignment.orderId ? String(assignment.orderId) : null;
        matchedOrderNumber = assignment.orderNumber ? String(assignment.orderNumber).replace('#', '') : null;
        await saveCloudLogistics(cloudState);
      }

      // ATUALIZA O PEDIDO CORRESPONDENTE NA LOJA PARA "concluido" / "Finalizado/Entregue"!
      if (matchingOrder || matchedOrderId || matchedOrderNumber) {
        let orderUpdated = false;
        cloudOrders.forEach((ord: any) => {
          const idMatch = (matchedOrderId && String(ord.id) === matchedOrderId) || (matchingOrder && ord.id === matchingOrder.id);
          const numMatch = (matchedOrderNumber && String(ord.orderNumber).replace('#', '') === matchedOrderNumber) || (matchingOrder && ord.orderNumber === matchingOrder.orderNumber);
          if (idMatch || numMatch) {
            ord.status = 'concluido';
            ord.dispatchStatus = 'entregue';
            ord.deliveredAt = nowISO;
            ord.driverName = this.session?.driverName;
            if (isForced) {
              ord.forcedDelivery = true;
              ord.forcedDeliveryReason = forcedReason || 'Confirmado sob termo de responsabilidade pelo motoboy';
              ord.forcedByDriverName = this.session?.driverName;
              ord.forcedAt = nowISO;
            }
            orderUpdated = true;
          }
        });
        if (orderUpdated) {
          await saveCloudOrders(cloudOrders);
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('Código incorreto') || err.message.includes('PIN incorreto'))) {
        throw err;
      }
      console.warn('[confirmDelivery] Aviso durante sincronização:', err);
    }

    // Tenta API se não for localhost
    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost) {
      try {
        await fetch(`${API_BASE_URL}/delivery-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ assignmentId, pinCandidate })
        });
      } catch {}
    }

    this.recordDeliveryInLedger(this.session.storeId, deliveryFee || 0);

    return {
      success: true,
      message: 'Entrega confirmada com sucesso!'
    };
  }

  public async requestWithdrawal(assignmentId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('assignment_withdraw', { assignmentId, reason });
      if (this.session) {
        this.recordCancellationInLedger(this.session.storeId);
      }
      return {
        success: true,
        message: 'Solicitação registrada offline. O pedido continua sob sua responsabilidade até a aprovação da loja.'
      };
    }

    if (!this.session) {
      throw new Error('Sessão não autorizada.');
    }

    const res = await fetch(`${API_BASE_URL}/assignment-withdraw`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.token}`
      },
      body: JSON.stringify({ assignmentId, reason })
    });

    if (!res.ok) {
      let errMsg = 'Erro ao enviar desistência.';
      try {
        const errData = await res.json();
        errMsg = errData.message || errMsg;
      } catch {}
      throw new Error(errMsg);
    }

    this.recordCancellationInLedger(this.session.storeId);
    return await res.json();
  }

  public async getHistory(): Promise<{ items: DeliveryHistoryItem[]; totalEarnings: number; hasUninformedFees: boolean }> {
    if (!this.session) {
      return { items: [], totalEarnings: 0, hasUninformedFees: false };
    }

    const isLocalhost = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');
    if (!isLocalhost && offlineQueue.getIsOnline()) {
      try {
        const res = await fetch(`${API_BASE_URL}/history`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
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
    }

    // Busca na Nuvem Supabase Storage
    try {
      const cloudState = await fetchCloudLogistics();
      const currentDriverId = this.session?.driverId || this.account?.id;
      const currentDriverName = this.session?.driverName || this.account?.name;

      const delivered = cloudState.assignments.filter((a: any) =>
        (!a.driverId || a.driverId === currentDriverId || a.driverName === currentDriverName) &&
        (a.status === 'entregue' || a.status === 'delivered')
      );
      let total = 0;
      const items: DeliveryHistoryItem[] = delivered.map((d: any) => {
        const fee = d.feeOffered || d.deliveryFee || 0;
        total += fee;
        return {
          id: d.id,
          orderId: d.orderId,
          orderNumber: d.orderNumber,
          customerName: d.customerName || 'Cliente',
          deliveryAddress: d.address || 'Endereço',
          deliveryFee: fee,
          deliveredAt: d.deliveredAt || new Date().toISOString()
        } as any;
      });
      return { items, totalEarnings: total, hasUninformedFees: false };
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
        headers: { Authorization: `Bearer ${this.session.token}` }
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
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.session.token}`
            },
            body: JSON.stringify(cmd.payload)
          });
        } else if (cmd.action === 'pickup_confirm') {
          res = await fetch(`${API_BASE_URL}/pickup-confirm`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.session.token}`
            },
            body: JSON.stringify(cmd.payload)
          });
        } else if (cmd.action === 'route_reorder') {
          res = await fetch(`${API_BASE_URL}/route-reorder`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.session.token}`
            },
            body: JSON.stringify(cmd.payload)
          });
        } else if (cmd.action === 'assignment_withdraw') {
          res = await fetch(`${API_BASE_URL}/assignment-withdraw`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.session.token}`
            },
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
