import { OfflineCommand } from '../types';

const QUEUE_STORAGE_KEY = 'novaesweb_offline_queue_v1';

class OfflineQueueManager {
  private context: {accountId:string;accountToken:string;shiftToken:string} | null = null;
  private queue: OfflineCommand[] = [];
  private listeners: ((queue: OfflineCommand[]) => void)[] = [];

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  public getIsOnline(): boolean {
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  }

  private loadQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      const stored = localStorage.getItem(QUEUE_STORAGE_KEY);
      if (stored) {
        this.queue = JSON.parse(stored);
      }
    } catch (e) {
      console.error('Falha ao carregar fila offline:', e);
      this.queue = [];
    }
  }

  private saveQueue(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
      this.notify();
    } catch (e) {
      console.error('Falha ao salvar fila offline:', e);
    }
  }

  public enqueue(action: OfflineCommand['action'], payload: any): OfflineCommand {
    if (!this.context?.accountToken || !this.context?.shiftToken) throw new Error('Entre na conta e na loja antes de guardar uma confirmação.');
    const command: OfflineCommand = {
      ...this.context,
      id: 'cmd_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      action,
      payload,
      idempotencyKey: 'idem_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
      createdAt: new Date().toISOString(),
      status: 'pending',
      retryCount: 0
    };

    this.queue.push(command);
    this.saveQueue();
    return command;
  }

  public getPendingCount(): number {
    return this.queue.filter(c => c.status === 'pending' || c.status === 'syncing').length;
  }

  public getQueue(): OfflineCommand[] {
    return [...this.queue];
  }

  public markConfirmed(commandId: string): void {
    this.queue = this.queue.filter(c => c.id !== commandId);
    this.saveQueue();
  }

  public markFailed(commandId: string, error: string, retryable = false): void {
    const cmd = this.queue.find(c => c.id === commandId);
    if (cmd) {
      cmd.status = retryable ? 'pending' : 'failed';
      cmd.retryCount++;
      cmd.lastError = error;
      this.saveQueue();
    }
  }

  public clearQueue(): void {
    this.queue = [];
    this.context = null;
    this.saveQueue();
  }

  public setContext(accountId:string, accountToken:string, shiftToken:string): void {
    this.context = {accountId,accountToken,shiftToken};
    this.queue = this.queue.filter(command => command.accountId === accountId && command.accountToken === accountToken);
    this.saveQueue();
  }

  public subscribe(listener: (queue: OfflineCommand[]) => void): () => void {
    this.listeners.push(listener);
    listener([...this.queue]);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify(): void {
    this.listeners.forEach(l => l([...this.queue]));
  }

  private handleNetworkChange(): void {
    this.notify();
  }
}

export const offlineQueue = new OfflineQueueManager();
