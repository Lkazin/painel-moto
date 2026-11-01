import { DriverSession, DriverPresence, StoreShiftSummary, Offer, Assignment, RouteStop, DeliveryHistoryItem, RatingsData } from '../types';
import { offlineQueue } from './offlineQueue';
import { accountClient, AccountRequestError } from './accountClient';
import { logisticsApiUrl } from './logisticsConfig';

const CACHE_KEY = 'novaesweb_driver_cache_v3';
const LEGACY_SESSION_KEY = 'novaesweb_driver_session_v2';
export class ApiClient {
  private session: DriverSession | null = null;
  private ledger: StoreShiftSummary[] = [];
  private presence: DriverPresence = { manualEnabled: true, isOnline: true, lastHeartbeat: new Date().toISOString() };
  private bootstrapped = false;
  private legacySession: DriverSession | null = null;
  private flushPromise: Promise<{ syncedCount: number; errors: number }> | null = null;
  constructor() {
    try {
      this.legacySession = JSON.parse(localStorage.getItem(LEGACY_SESSION_KEY) || 'null');
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null');
      if (cached?.accountId === accountClient.getAccount()?.id) { this.session = cached.session; this.ledger = cached.ledger || []; }
    } catch { /* Dados locais antigos não autorizam acesso. */ }
    accountClient.subscribe(message => {
      this.bootstrapped = false; this.session = null; this.ledger = []; offlineQueue.clearQueue();
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem(LEGACY_SESSION_KEY);
      localStorage.removeItem('novaesweb_driver_account_v2');
      localStorage.removeItem('novaesweb_stores_ledger_v2');
      localStorage.removeItem('novaesweb_driver_presence_v2');
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('novaesweb:account-change', { detail: { message } }));
    });
    localStorage.removeItem('novaesweb_driver_registered_accounts');
  }
  private persist() {
    const account = accountClient.getAccount();
    if (!account) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify({ accountId: account.id, session: this.session, ledger: this.ledger }));
    // Identidade usada somente pelo serviço GPS; autorização vem dos tokens do servidor.
    if (this.session) localStorage.setItem(LEGACY_SESSION_KEY, JSON.stringify(this.session)); else localStorage.removeItem(LEGACY_SESSION_KEY);
    localStorage.setItem('novaesweb_driver_account_v2', JSON.stringify(account));
  }
  public getDriverAccount() { return accountClient.getAccount(); }
  public getSession() { return this.bootstrapped ? this.session : null; }
  public hasAccountAccess() { return Boolean(accountClient.getToken()); }
  public isReady() { return this.bootstrapped; }
  public getPresence(): DriverPresence { return { ...this.presence, isOnline: offlineQueue.getIsOnline() }; }
  public getStoresLedger() { return [...this.ledger]; }
  public getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.session) { headers.Authorization = 'Bearer ' + this.session.token; headers['x-session-token'] = this.session.token; headers['x-driver-id'] = this.session.driverId; headers['x-store-id'] = this.session.storeId; }
    return headers;
  }
  private async request(action: string, body?: unknown, extraHeaders?: Record<string, string>) {
    const shiftToken = this.session?.token;
    const data = await accountClient.request(logisticsApiUrl() + '/' + action, { method: body === undefined ? 'GET' : 'POST', headers: { ...this.getAuthHeaders(), ...extraHeaders }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    if (shiftToken !== this.session?.token) throw new AccountRequestError('O plantão foi alterado. Atualize os dados.', 'STALE_REQUEST');
    return data;
  }
  private identity() {
    if (!this.bootstrapped || !this.session || !accountClient.getToken()) throw new Error('Confirme sua conexão e entre na loja para continuar.');
    return { driverId: this.session.driverId, membershipId: this.session.membershipId, storeId: this.session.storeId };
  }
  private query(action: string) { const identity = this.identity(); return action + '?' + new URLSearchParams(identity).toString(); }
  private async authenticate(action: 'login' | 'register', body: unknown) {
    const account = await accountClient.authenticate(action, body);
    this.legacySession = null; localStorage.removeItem(LEGACY_SESSION_KEY);
    await this.synchronizeAccount(); return account;
  }
  public verifyStoreCode(code: string) { return accountClient.verifyCode(code); }
  public registerDriver(name: string, phone: string, vehiclePlate: string, vehicleModel: string, password: string, registrationCode: string) { return this.authenticate('register', { name, phone, vehiclePlate, vehicleModel, password, registrationCode }); }
  public loginDriver(identifier: string, password: string) { return this.authenticate('login', { identifier, password }); }
  public async synchronizeAccount() {
    await accountClient.validate();
    const data = await this.request('account-bootstrap');
    if (!data.account?.id || data.account.id !== accountClient.getAccount()?.id) throw new Error('Dados de conta inválidos.');
    this.session = data.session || null; this.ledger = Array.isArray(data.ledger) ? data.ledger : [];
    this.bootstrapped = true;
    if (data.presence) this.presence = { ...this.presence, ...data.presence };
    this.persist();
    offlineQueue.setContext(accountClient.getAccount()!.id, accountClient.getToken(), this.session?.token || '');
    return { account: accountClient.getAccount(), session: this.session };
  }
  public async logoutDriver() { this.legacySession = null; localStorage.removeItem(LEGACY_SESSION_KEY); localStorage.removeItem('novaesweb_driver_account_v2'); await accountClient.logout(); }
  public logout() { return this.logoutDriver(); }
  public clearAllLocalData() { this.legacySession = null; accountClient.clear(); localStorage.removeItem(LEGACY_SESSION_KEY); localStorage.removeItem('novaesweb_driver_account_v2'); }
  public async activateInvite(code: string, _fingerprint?: string) { return this.activateStoreShift(code); }
  public async activateStoreShift(inviteCode: string): Promise<DriverSession> {
    if (!this.bootstrapped) throw new Error('Aguarde a sincronização da sua conta.');
    const fingerprint = localStorage.getItem('novaesweb_device_fp') || crypto.randomUUID();
    localStorage.setItem('novaesweb_device_fp', fingerprint);
    await this.request('invite-activate', { inviteCode: inviteCode.trim().toUpperCase(), deviceFingerprint: fingerprint });
    await this.synchronizeAccount();
    if (!this.session) throw new Error('O vínculo não foi confirmado pela loja.');
    return this.session;
  }
  public async closeStoreShift(): Promise<{ shiftSummary: StoreShiftSummary }> {
    const identity = this.identity(); const previous = this.ledger.find(item => item.storeId === identity.storeId);
    await this.request('shift-close', identity); await this.synchronizeAccount();
    const summary = this.ledger.find(item => item.storeId === identity.storeId) || previous;
    if (!summary) throw new Error('O extrato da loja não foi carregado.');
    return { shiftSummary: summary };
  }
  public async validateSession(): Promise<{ valid: boolean; session?: DriverSession }> {
    if (!this.session) return { valid: false };
    try { const data = await this.request(this.query('session-validate')); return { valid: true, session: data.session || this.session }; }
    catch (error) { if (error instanceof AccountRequestError && [401, 403].includes(error.status)) { this.session = null; this.persist(); return { valid: false }; } throw error; }
  }
  public async setPresence(manualEnabled: boolean) { await this.request('driver-presence', { ...this.identity(), manualEnabled }); this.presence = { ...this.presence, manualEnabled, lastHeartbeat: new Date().toISOString() }; return this.getPresence(); }
  public async getOffers(): Promise<Offer[]> { if (!this.session) return []; const data = await this.request(this.query('offers')); const list = Array.isArray(data) ? data : data.offers || []; return list.filter((offer: Offer) => !offer.expiresAt || Date.parse(offer.expiresAt) > Date.now()); }
  public respondOffer(offerId: string, decision: 'accepted' | 'rejected') { return this.request('offer-respond', { ...this.identity(), offerId, decision }); }
  public async getAssignments(): Promise<Assignment[]> { if (!this.session) return []; const data = await this.request(this.query('assignments')); return Array.isArray(data) ? data : data.assignments || []; }
  public async confirmPickup(assignmentIds: string[]): Promise<{ confirmed: string[]; errors: Record<string, string> }> {
    if (!offlineQueue.getIsOnline()) throw new Error('Conecte-se à internet para confirmar a retirada.');
    const data = await this.request('pickup-confirm', { ...this.identity(), assignmentIds }); return { confirmed: data.confirmed || [], errors: data.errors || {} };
  }
  public async getCurrentRoute(): Promise<RouteStop[]> { if (!this.session) return []; const data = await this.request(this.query('route-current')); return Array.isArray(data) ? data : data.stops || []; }
  public async reorderRoute(stops: { assignmentId: string; sequence: number }[]): Promise<boolean> { if (!offlineQueue.getIsOnline()) throw new Error('Conecte-se à internet para salvar a rota.'); await this.request('route-reorder', { ...this.identity(), stops }); return true; }
  public async confirmDelivery(assignmentId: string, pinCandidate: string, _deliveryFee?: number | null, isForced?: boolean, forcedReason?: string): Promise<{ success: boolean; message: string; isOfflinePending?: boolean }> {
    const identity = this.identity(); const body = { ...identity, assignmentId, pinCandidate, isForced, forcedReason };
    if (!offlineQueue.getIsOnline()) { offlineQueue.enqueue('delivery_confirm', body); return { success: true, isOfflinePending: true, message: 'Confirmação guardada neste aparelho, pendente de validação pela loja ao reconectar.' }; }
    return this.request('delivery-confirm', body);
  }
  public async requestWithdrawal(assignmentId: string, reason: string): Promise<{ success: boolean; message: string }> { if (!offlineQueue.getIsOnline()) throw new Error('Conecte-se à internet para solicitar a desistência.'); return this.request('assignment-withdraw', { ...this.identity(), assignmentId, reason }); }
  public async getHistory(): Promise<{ items: DeliveryHistoryItem[]; totalEarnings: number; hasUninformedFees: boolean }> {
    if (!this.session) return { items: [], totalEarnings: 0, hasUninformedFees: false }; const data = await this.request(this.query('history')); const items: DeliveryHistoryItem[] = Array.isArray(data) ? data : data.items || [];
    return { items, totalEarnings: items.reduce((total, item) => total + (item.deliveryFee || 0), 0), hasUninformedFees: items.some(item => item.deliveryFee == null) };
  }
  public async getRatings(): Promise<RatingsData> { return this.request(this.query('ratings')); }
  public flushOfflineQueue(): Promise<{ syncedCount: number; errors: number }> { if (this.flushPromise) return this.flushPromise; this.flushPromise = this.flushCommands().finally(() => { this.flushPromise = null; }); return this.flushPromise; }
  private async flushCommands() {
    if (!offlineQueue.getIsOnline() || !this.session || !this.bootstrapped) return { syncedCount: 0, errors: 0 };
    await accountClient.validate(); let syncedCount = 0, errors = 0;
    const accountId = accountClient.getAccount()?.id, accountToken = accountClient.getToken();
    for (const command of offlineQueue.getQueue()) {
      if (accountClient.getToken() !== accountToken) break;
      if (command.accountId !== accountId || command.accountToken !== accountToken || !command.shiftToken) { offlineQueue.markConfirmed(command.id); continue; }
      if (command.status === 'failed') continue;
      try {
        const action = { delivery_confirm: 'delivery-confirm', pickup_confirm: 'pickup-confirm', route_reorder: 'route-reorder', assignment_withdraw: 'assignment-withdraw' }[command.action];
        await this.request(action, command.payload, { 'x-idempotency-key': command.idempotencyKey, Authorization: 'Bearer ' + command.shiftToken, 'x-session-token': command.shiftToken, 'x-driver-id': command.payload.driverId, 'x-store-id': command.payload.storeId }); offlineQueue.markConfirmed(command.id); syncedCount++;
      } catch (error) { errors++; if (!accountClient.getToken()) break; offlineQueue.markFailed(command.id, error instanceof Error ? error.message : 'Erro ao sincronizar', !(error instanceof AccountRequestError) || error.status >= 500); }
    }
    return { syncedCount, errors };
  }
}
export const api = new ApiClient();
