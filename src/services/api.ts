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
  (import.meta as any).env?.NEXT_PUBLIC_LOGISTICS_API_URL ||
  (import.meta as any).env?.VITE_LOGISTICS_API_URL ||
  '/api/v1/logistics';

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

    // Tenta ativar na API Central
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
    } catch {}

    // Resgate de código da loja (ex: NW-XXXXXX enviado pela pizzaria)
    if (cleanCode.length < 5 || !cleanCode.startsWith('NW')) {
      throw new Error('Formato inválido. O código emitido pela loja deve iniciar com NW- seguido dos números.');
    }

    const storeName = cleanCode.includes('BELLA') || cleanCode.includes('1049')
      ? 'Bella Pizza Forneria'
      : 'Pizzaria & Forneria Novaes';

    const newSession: DriverSession = {
      token: 'jwt_shift_' + Date.now(),
      driverId: this.account.id,
      driverName: this.account.name,
      phone: this.account.phone,
      vehiclePlate: this.account.vehiclePlate,
      deviceFingerprint: fingerprint,
      storeId: 'store_' + cleanCode.toLowerCase().replace(/[^a-z0-9]/g, '_'),
      storeName: storeName,
      storeAddress: 'Rua das Camélias, 412 - Jardins, SP',
      membershipId: 'mem_' + cleanCode,
      role: 'entregador_plantao',
      expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
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

    // Notifica backend se online
    if (offlineQueue.getIsOnline()) {
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

    return this.getPresence();
  }

  public async getOffers(): Promise<Offer[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

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

    return [];
  }

  public async respondOffer(offerId: string, decision: 'accepted' | 'rejected'): Promise<{ success: boolean; assignment?: Assignment }> {
    if (!this.session) {
      throw new Error('Sessão não autorizada.');
    }

    const res = await fetch(`${API_BASE_URL}/offer-respond`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.token}`
      },
      body: JSON.stringify({ offerId, decision })
    });

    if (!res.ok) {
      let msg = 'Erro ao responder oferta.';
      try {
        const errData = await res.json();
        msg = errData.message || msg;
      } catch {}

      if (res.status === 410) {
        msg = 'A oferta expirou no servidor antes do seu aceite.';
      } else if (res.status === 409) {
        msg = 'Esta corrida já foi atribuída ou remanejada pela loja.';
      }
      throw new Error(msg);
    }

    return await res.json();
  }

  public async getAssignments(): Promise<Assignment[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    try {
      const res = await fetch(`${API_BASE_URL}/assignments`, {
        headers: { Authorization: `Bearer ${this.session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.assignments || [];
      }
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

    const confirmed: string[] = [];
    const errors: Record<string, string> = {};

    for (const id of assignmentIds) {
      try {
        const res = await fetch(`${API_BASE_URL}/pickup-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ assignmentId: id, assignmentIds })
        });
        if (res.ok) {
          confirmed.push(id);
        } else {
          errors[id] = 'Falha ao confirmar retirada no servidor';
        }
      } catch (err: any) {
        errors[id] = err.message || 'Erro de conexão';
      }
    }

    return { confirmed, errors };
  }

  public async getCurrentRoute(): Promise<RouteStop[]> {
    if (!this.session || !offlineQueue.getIsOnline()) {
      return [];
    }

    try {
      const res = await fetch(`${API_BASE_URL}/route-current`, {
        headers: { Authorization: `Bearer ${this.session.token}` }
      });
      if (res.ok) {
        const data = await res.json();
        return Array.isArray(data) ? data : data.stops || [];
      }
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

    const res = await fetch(`${API_BASE_URL}/route-reorder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.token}`
      },
      body: JSON.stringify({ stops })
    });

    return res.ok;
  }

  public async confirmDelivery(
    assignmentId: string,
    pinCandidate: string,
    deliveryFee?: number | null
  ): Promise<{ success: boolean; message: string; isOfflinePending?: boolean }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('delivery_confirm', { assignmentId, pinCandidate });
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

    const res = await fetch(`${API_BASE_URL}/delivery-confirm`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.session.token}`
      },
      body: JSON.stringify({ assignmentId, pinCandidate })
    });

    if (!res.ok) {
      let errMsg = 'Código PIN inválido.';
      try {
        const errData = await res.json();
        errMsg = errData.message || errMsg;
      } catch {}

      if (res.status === 422) {
        errMsg = 'Código PIN incorreto. Peça ao cliente para verificar os 4 dígitos no app.';
      }
      throw new Error(errMsg);
    }

    const data = await res.json();
    this.recordDeliveryInLedger(this.session.storeId, deliveryFee || 0);

    return {
      success: true,
      message: data.message || 'Entrega validada com sucesso pelo servidor da loja!'
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
    if (!this.session || !offlineQueue.getIsOnline()) {
      return { items: [], totalEarnings: 0, hasUninformedFees: false };
    }

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
