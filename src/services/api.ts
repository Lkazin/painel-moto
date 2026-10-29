import {
  DriverSession,
  DriverPresence,
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
  'http://localhost:3000/api/v1/logistics';

const SESSION_STORAGE_KEY = 'novaesweb_driver_session';
const PRESENCE_STORAGE_KEY = 'novaesweb_driver_presence';

class ApiClient {
  private session: DriverSession | null = null;
  private presence: DriverPresence = {
    manualEnabled: true,
    isOnline: true,
    lastHeartbeat: new Date().toISOString()
  };

  constructor() {
    this.initFromLocalStorage();
  }

  private initFromLocalStorage(): void {
    if (typeof window === 'undefined') return;

    try {
      const storedSession = localStorage.getItem(SESSION_STORAGE_KEY);
      if (storedSession) {
        this.session = JSON.parse(storedSession);
      }

      const storedPresence = localStorage.getItem(PRESENCE_STORAGE_KEY);
      if (storedPresence) {
        this.presence = JSON.parse(storedPresence);
      }
    } catch (e) {
      console.warn('Erro ao restaurar sessão:', e);
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

  public getSession(): DriverSession | null {
    return this.session;
  }

  public getPresence(): DriverPresence {
    return {
      ...this.presence,
      isOnline: offlineQueue.getIsOnline()
    };
  }

  // 1. POST /invite-activate
  public async activateInvite(inviteCode: string, deviceFingerprint: string): Promise<DriverSession> {
    const cleanCode = inviteCode.trim().toUpperCase();

    const response = await fetch(`${API_BASE_URL}/invite-activate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inviteCode: cleanCode, deviceFingerprint })
    });

    if (!response.ok) {
      let errorMsg = 'Código inválido ou não autorizado.';
      try {
        const errData = await response.json();
        errorMsg = errData.message || errData.error || errorMsg;
      } catch {}

      if (response.status === 410) {
        errorMsg = 'Código de uso único expirado desde a emissão pela loja.';
      } else if (response.status === 409) {
        errorMsg = 'Este código já foi resgatado em outro aparelho.';
      } else if (response.status === 403) {
        errorMsg = 'Vínculo do entregador não autorizado ou bloqueado pela loja.';
      }
      throw new Error(errorMsg);
    }

    const data = await response.json();
    this.session = data.session || data;
    this.presence.manualEnabled = true;
    this.saveSession();
    this.savePresence();
    return this.session!;
  }

  // 2. GET /session-validate
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
        this.logout();
        return { valid: false };
      }
    } catch {
      // Se estiver offline no momento, mantém sessão se data local não estiver expirada
      const isExpired = new Date(currentSession.expiresAt).getTime() < Date.now();
      if (isExpired) {
        return { valid: false };
      }
      return { valid: true, session: currentSession };
    }

    return { valid: true, session: currentSession };
  }

  // 3. POST /driver-presence
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
      } catch (err) {
        console.warn('Erro ao atualizar presença no servidor:', err);
      }
    }

    return this.getPresence();
  }

  // 4. GET /offers
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
    } catch (err) {
      console.warn('Erro ao consultar ofertas ao vivo:', err);
    }

    return [];
  }

  // 5. POST /offer-respond
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
      } else if (res.status === 422) {
        msg = 'Limite máximo de pedidos simultâneos atingido (capacidade da loja).';
      }
      throw new Error(msg);
    }

    return await res.json();
  }

  // 6. GET /assignments
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
    } catch (err) {
      console.warn('Erro ao buscar pedidos atribuídos:', err);
    }

    return [];
  }

  // 7. POST /pickup-confirm
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

    // Envia requisições conformes ao contrato do backend
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

  // 8. GET /route-current
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

  // 9. POST /route-reorder
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

  // 10. POST /delivery-confirm (Validação de PIN de 4 dígitos)
  public async confirmDelivery(assignmentId: string, pinCandidate: string): Promise<{ success: boolean; message: string; isOfflinePending?: boolean }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('delivery_confirm', { assignmentId, pinCandidate });
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
      } else if (res.status === 429) {
        errMsg = 'Limite de tentativas excedido. Solicite exceção à loja.';
      }
      throw new Error(errMsg);
    }

    const data = await res.json();
    return {
      success: true,
      message: data.message || 'Entrega validada com sucesso pelo servidor da loja!'
    };
  }

  // 11. POST /assignment-withdraw (Solicitação de Desistência)
  public async requestWithdrawal(assignmentId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('assignment_withdraw', { assignmentId, reason });
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

    return await res.json();
  }

  // 12. GET /history
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
    } catch (err) {
      console.warn('Erro ao buscar histórico ao vivo:', err);
    }

    return { items: [], totalEarnings: 0, hasUninformedFees: false };
  }

  // 13. GET /ratings
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

  // Flush da fila offline ao vivo quando a internet retorna
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

  // Logout e limpeza segura
  public logout(): void {
    this.session = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }
}

export const api = new ApiClient();
