import { OfflineCommand } from '../types';

const QUEUE_STORAGE_KEY = 'novaesweb_offline_queue_v1';
const SIMULATED_OFFLINE_KEY = 'novaesweb_simulated_offline';

class OfflineQueueManager {
  private queue: OfflineCommand[] = [];
  private listeners: ((queue: OfflineCommand[]) => void)[] = [];
  private isSimulatedOffline = false;

  constructor() {
    this.loadQueue();
    if (typeof window !== 'undefined') {
      this.isSimulatedOffline = localStorage.getItem(SIMULATED_OFFLINE_KEY) === 'true';
      window.addEventListener('online', () => this.handleNetworkChange());
      window.addEventListener('offline', () => this.handleNetworkChange());
    }
  }

  public getIsOnline(): boolean {
    if (this.isSimulatedOffline) return false;
    if (typeof navigator !== 'undefined') {
      return navigator.onLine;
    }
    return true;
  }

  public toggleSimulatedOffline(): boolean {
    this.isSimulatedOffline = !this.isSimulatedOffline;
    if (typeof window !== 'undefined') {
      localStorage.setItem(SIMULATED_OFFLINE_KEY, String(this.isSimulatedOffline));
    }
    this.notify();
    return this.isSimulatedOffline;
  }

  public getIsSimulated(): boolean {
    return this.isSimulatedOffline;
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
    const command: OfflineCommand = {
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

  public markFailed(commandId: string, error: string): void {
    const cmd = this.queue.find(c => c.id === commandId);
    if (cmd) {
      cmd.status = 'failed';
      cmd.retryCount++;
      cmd.lastError = error;
      this.saveQueue();
    }
  }

  public clearQueue(): void {
    this.queue = [];
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
