import { DriverAccount, FirstAccessChallenge, FirstAccessDetails } from '../types';
import { logisticsApiUrl } from './logisticsConfig';
import { supportsBackgroundTracking, nativeAccountRequest } from './nativeTracking';
import { driverSecurity, nativeSecureAccess } from './driverSecurity';


const KEY = 'novaesweb_account_access_v1';
const NOTICE_KEY = 'novaesweb_account_notice_v1';
export const ACCOUNT_REPLACED_MESSAGE = 'Sua conta foi acessada em outro aparelho. Entre novamente para continuar.';
export class AccountRequestError extends Error {
  public code: string;
  public status: number;
  constructor(message: string, code = '', status = 0) { super(message); this.code=code; this.status=status; }
}
class AccountClient {
  private token = '';
  private account: DriverAccount | null = null;
  private revision = 0;
  private locked = false;
  private restored = false;
  private onboardingRevision = 0;
  private onboarding: FirstAccessChallenge | null = null;
  private onboardingRequest: AbortController | null = null;
  private listeners = new Set<(message?: string) => void>();
  constructor() {
    if (nativeSecureAccess()) return; // Android: nunca restaura token diretamente do armazenamento web.
    try {
      // Web/PWA: sessão dura somente até fechar o navegador (não fica no localStorage).
      const storage = typeof sessionStorage === 'undefined' ? localStorage : sessionStorage;
      const stored = JSON.parse(storage.getItem(KEY) || 'null');
      if (stored?.accountToken && stored?.account?.id) { this.token = stored.accountToken; this.account = stored.account; }
      if (storage !== localStorage) localStorage.removeItem(KEY);
    } catch { /* Cache inválido é ignorado. */ }
  }
  /** Executar antes de liberar a interface do Android. Não solicita biometria sem ação do usuário. */
  async restore(): Promise<'ready' | 'locked' | 'none'> {
    if (!nativeSecureAccess()) return this.account ? 'ready' : 'none';
    if (this.restored) return this.locked ? 'locked' : this.account ? 'ready' : 'none';
    this.restored = true;
    try {
      const status = await driverSecurity.status();
      if (status.enabled && status.hasAccount) { this.locked = true; return 'locked'; }
      let saved = status.hasAccount ? await driverSecurity.read('account') : null;
      if (!saved) {
        // Migração única de token legado para Android Keystore.
        const legacy = localStorage.getItem(KEY);
        if (legacy) { await driverSecurity.save('account', legacy); saved = legacy; }
      }
      localStorage.removeItem(KEY);
      if (!saved) return 'none';
      const parsed = JSON.parse(saved);
      if (!parsed?.accountToken || !parsed?.account?.id) return 'none';
      this.token = parsed.accountToken; this.account = parsed.account;
      return 'ready';
    } catch {
      // Falha fechada: senha sempre continua disponível.
      localStorage.removeItem(KEY);
      return 'none';
    }
  }
  isLocked() { return this.locked; }
  async biometricStatus() {
    if (!nativeSecureAccess()) return { available: false, enabled: false, hasAccount: false };
    return driverSecurity.status();
  }
  async configureBiometric(enabled: boolean) {
    if (!nativeSecureAccess() || !this.token || !this.account || this.locked) throw new Error('Entre na sua conta para configurar a biometria.');
    await driverSecurity.configure(enabled);
    return this.biometricStatus();
  }
  async lockWithBiometrics() {
    if (!nativeSecureAccess()) return false;
    const status = await driverSecurity.status();
    if (!status.enabled || !status.hasAccount) return false;
    this.locked = true;
    await driverSecurity.lock();
    return true;
  }
  async unlockWithBiometrics(): Promise<DriverAccount> {
    if (!nativeSecureAccess()) throw new Error('Biometria disponível apenas no aplicativo Android.');
    const raw = await driverSecurity.unlock();
    const parsed = JSON.parse(raw || 'null');
    if (!parsed?.accountToken || !parsed?.account?.id) throw new Error('A sessão não está disponível. Entre com sua senha.');
    this.revision++;
    this.token = parsed.accountToken; this.account = parsed.account; this.locked = false;
    return this.account!;
  }
  getAccount() { return this.account; }
  getNotice() { return localStorage.getItem(NOTICE_KEY) || ''; }
  getToken() { return this.locked ? '' : this.token; }
  subscribe(listener: (message?: string) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(message?: string) { this.listeners.forEach(listener => listener(message)); }
  clear(message?: string) {
    this.cancelFirstAccess();
    this.revision++; this.token = ''; this.account = null; this.locked = false;
    localStorage.removeItem(KEY);
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(KEY);
    if (nativeSecureAccess()) void driverSecurity.remove('account');
    if (message) localStorage.setItem(NOTICE_KEY,message); else localStorage.removeItem(NOTICE_KEY);
    this.notify(message);
  }
  private async save() {
    const saved = JSON.stringify({ accountToken: this.token, account: this.account });
    if (nativeSecureAccess()) {
      await driverSecurity.save('account', saved);
      localStorage.removeItem(KEY);
    } else {
      const storage = typeof sessionStorage === 'undefined' ? localStorage : sessionStorage;
      storage.setItem(KEY, saved);
      if (storage !== localStorage) localStorage.removeItem(KEY);
    }
  }
  async authenticate(action: 'login', body: unknown) {
    this.cancelFirstAccess();
    const revision = this.revision;
    const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-account') + '/' + action,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'});
    const data = await response.json().catch(() => ({}));
    if (revision !== this.revision) throw new AccountRequestError('A conta foi alterada. Tente novamente.', 'STALE_REQUEST');
    if (!response.ok || !data.success || !data.account?.id || !data.accountToken) throw new AccountRequestError(data.error || 'Não foi possível entrar na conta.', data.code, response.status);
    // Senha validada no servidor recupera a conta quando a biometria antiga não funciona.
    // Em recuperação, remove o bloqueio antigo; o motoboy pode reativá-lo em Configurações.
    if (nativeSecureAccess() && (await driverSecurity.status()).enabled && this.locked) await driverSecurity.remove('account');
    this.revision++; this.token = data.accountToken; this.account = data.account; this.locked = false; localStorage.removeItem(NOTICE_KEY); await this.save(); this.notify();
    return this.account!;
  }
  async request(url: string, options: RequestInit = {}) {
    if (this.locked) throw new AccountRequestError('Desbloqueie o aplicativo para continuar.', 'BIOMETRIC_REQUIRED', 423);
    const token = this.token, revision = this.revision;
    if (!token) throw new AccountRequestError('Entre na sua conta para continuar.', 'ACCOUNT_SESSION_REQUIRED', 401);
    const requestOptions = {...options, cache: 'no-store' as RequestCache, headers: {...Object.fromEntries(new Headers(options.headers).entries()), 'x-account-session': token}};
    const response = supportsBackgroundTracking() ? await nativeAccountRequest(url, requestOptions) : await fetch(url, requestOptions);
    const data = await response.json().catch(() => ({}));
    if (token !== this.token || revision !== this.revision) throw new AccountRequestError('A conta foi alterada. Atualize os dados.', 'STALE_REQUEST');
    if (response.status === 401 && ['ACCOUNT_SESSION_REPLACED', 'ACCOUNT_SESSION_REQUIRED'].includes(data.code)) {
      this.clear(ACCOUNT_REPLACED_MESSAGE);
      throw new AccountRequestError(ACCOUNT_REPLACED_MESSAGE, data.code, 401);
    }
    if (!response.ok || data.success === false) throw new AccountRequestError(data.error || data.message || 'Não foi possível confirmar a operação com a loja.', data.code, response.status);
    return data;
  }
  cancelFirstAccess() {
    this.onboardingRevision++;
    this.onboardingRequest?.abort();
    this.onboardingRequest = null;
    this.onboarding = null;
  }
  async startFirstAccess(phone: string, code: string): Promise<FirstAccessChallenge> {
    this.cancelFirstAccess();
    const revision = this.revision, onboardingRevision = this.onboardingRevision;
    const controller = new AbortController();
    this.onboardingRequest = controller;
    const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-first-access') + '/start', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({phone,code}), cache: 'no-store', signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (revision !== this.revision || onboardingRevision !== this.onboardingRevision) throw new AccountRequestError('O primeiro acesso foi cancelado. Comece novamente.', 'STALE_REQUEST');
    if (!response.ok || !data.success) throw new AccountRequestError(data.error || 'Não foi possível conferir o primeiro acesso.', data.code, response.status);
    if (!data.onboardingToken || !data.name || !data.phone || !data.storeName || !Number.isFinite(Date.parse(data.expiresAt)) || Date.parse(data.expiresAt) <= Date.now()) throw new AccountRequestError('O código não gerou uma autorização válida. Peça outro à loja.');
    this.onboarding = {onboardingToken:data.onboardingToken,name:data.name,phone:data.phone,storeName:data.storeName,expiresAt:data.expiresAt};
    this.onboardingRequest = null;
    return this.onboarding;
  }
  async completeFirstAccess(details: FirstAccessDetails): Promise<DriverAccount> {
    if (!this.onboarding || details.onboardingToken !== this.onboarding.onboardingToken || Date.parse(this.onboarding.expiresAt) <= Date.now()) throw new AccountRequestError('Sua autorização expirou. Volte e peça outro código à loja.', 'ONBOARDING_EXPIRED');
    const revision = this.revision, onboardingRevision = this.onboardingRevision;
    const controller = new AbortController(); this.onboardingRequest = controller;
    const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-first-access') + '/complete', {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(details), cache: 'no-store', signal: controller.signal,
    });
    const data = await response.json().catch(() => ({}));
    if (revision !== this.revision || onboardingRevision !== this.onboardingRevision) throw new AccountRequestError('O primeiro acesso foi cancelado. Entre com sua senha se já concluiu o cadastro.', 'STALE_REQUEST');
    if (!response.ok || !data.success || !data.account?.id || !data.accountToken) throw new AccountRequestError(data.error || 'Não foi possível concluir seu cadastro.', data.code, response.status);
    this.onboarding = null; this.onboardingRequest = null; this.onboardingRevision++;
    this.revision++; this.token = data.accountToken; this.account = data.account; this.locked = false;
    localStorage.removeItem(NOTICE_KEY); await this.save(); this.notify();
    return this.account!;
  }
  async validate() {
    const data = await this.request(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-account') + '/me');
    if (!data.account?.id || data.account.id !== this.account?.id) throw new AccountRequestError('Resposta de conta inválida.');
    this.account = data.account; await this.save(); return this.account!;
  }
  async logout() {
    const token = this.token;
    this.clear();
    if (nativeSecureAccess()) await driverSecurity.remove('account');
    if (token) {
      const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-account') + '/logout', {method:'POST', headers: {'x-account-session': token}});
      if (!response.ok && response.status !== 401) throw new Error('Não foi possível encerrar o acesso no servidor. Entre novamente e tente sair.');
    }
  }
}
export const accountClient = new AccountClient();
