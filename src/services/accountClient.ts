import { DriverAccount } from '../types';
import { logisticsApiUrl } from './logisticsConfig';

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
  private listeners = new Set<(message?: string) => void>();
  constructor() {
    try { const stored = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (stored?.accountToken && stored?.account?.id) { this.token = stored.accountToken; this.account = stored.account; }
    } catch { /* Cache inválido é ignorado. */ }
  }
  getAccount() { return this.account; }
  getNotice() { return localStorage.getItem(NOTICE_KEY) || ''; }
  getToken() { return this.token; }
  subscribe(listener: (message?: string) => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
  private notify(message?: string) { this.listeners.forEach(listener => listener(message)); }
  clear(message?: string) {
    this.revision++; this.token = ''; this.account = null; localStorage.removeItem(KEY);
    if (message) localStorage.setItem(NOTICE_KEY,message); else localStorage.removeItem(NOTICE_KEY);
    this.notify(message);
  }
  private save() { localStorage.setItem(KEY, JSON.stringify({accountToken: this.token, account: this.account})); }
  async authenticate(action: 'register' | 'login', body: unknown) {
    const revision = this.revision;
    const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-account') + '/' + action,
      {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), cache: 'no-store'});
    const data = await response.json().catch(() => ({}));
    if (revision !== this.revision) throw new AccountRequestError('A conta foi alterada. Tente novamente.', 'STALE_REQUEST');
    if (!response.ok || !data.success || !data.account?.id || !data.accountToken) throw new AccountRequestError(data.error || 'Não foi possível entrar na conta.', data.code, response.status);
    this.revision++; this.token = data.accountToken; this.account = data.account; localStorage.removeItem(NOTICE_KEY); this.save(); this.notify();
    return this.account!;
  }
  async request(url: string, options: RequestInit = {}) {
    const token = this.token, revision = this.revision;
    if (!token) throw new AccountRequestError('Entre na sua conta para continuar.', 'ACCOUNT_SESSION_REQUIRED', 401);
    const response = await fetch(url, {...options, cache: 'no-store', headers: {...Object.fromEntries(new Headers(options.headers).entries()), 'x-account-session': token}});
    const data = await response.json().catch(() => ({}));
    if (token !== this.token || revision !== this.revision) throw new AccountRequestError('A conta foi alterada. Atualize os dados.', 'STALE_REQUEST');
    if (response.status === 401 && ['ACCOUNT_SESSION_REPLACED', 'ACCOUNT_SESSION_REQUIRED'].includes(data.code)) {
      this.clear(ACCOUNT_REPLACED_MESSAGE);
      throw new AccountRequestError(ACCOUNT_REPLACED_MESSAGE, data.code, 401);
    }
    if (!response.ok || data.success === false) throw new AccountRequestError(data.error || data.message || 'Não foi possível confirmar a operação com a loja.', data.code, response.status);
    return data;
  }
  async validate() {
    const data = await this.request(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-account') + '/me');
    if (!data.account?.id || data.account.id !== this.account?.id) throw new AccountRequestError('Resposta de conta inválida.');
    this.account = data.account; this.save(); return this.account!;
  }
  async logout() {
    const token = this.token;
    this.clear();
    if (token) {
      const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/driver-account') + '/logout', {method:'POST', headers: {'x-account-session': token}});
      if (!response.ok && response.status !== 401) throw new Error('Não foi possível encerrar o acesso no servidor. Entre novamente e tente sair.');
    }
  }
}
export const accountClient = new AccountClient();
