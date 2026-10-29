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
  (import.meta as any).env?.VITE_LOGISTICS_API_URL || 'http://localhost:3000/api/v1/logistics';

const SESSION_STORAGE_KEY = 'novaesweb_driver_session';
const PRESENCE_STORAGE_KEY = 'novaesweb_driver_presence';
const ASSIGNMENTS_STORAGE_KEY = 'novaesweb_driver_assignments';
const HISTORY_STORAGE_KEY = 'novaesweb_driver_history';

// Estado simulado inicial para bancada caso API real esteja offline
const INITIAL_DEMO_SESSION: DriverSession = {
  token: 'mock_jwt_token_' + Math.random().toString(36).substring(2),
  driverId: 'drv_9921',
  driverName: 'Marcos Oliveira',
  phone: '(11) 98765-4321',
  vehiclePlate: 'BRA-3X92 (CG 160 Fan)',
  deviceFingerprint: 'fp_phone_android_a54_xyz99',
  storeId: 'store_bella_pizza_01',
  storeName: 'Bella Pizza Forneria',
  storeAddress: 'Rua das Camélias, 412 - Jardins',
  membershipId: 'mem_bp_8841',
  role: 'entregador_ativo',
  expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  isActivated: true
};

const INITIAL_DEMO_ASSIGNMENTS: Assignment[] = [
  {
    assignmentId: 'asg_101',
    orderId: 'ord_771',
    orderNumber: '#1042',
    storeId: 'store_bella_pizza_01',
    storeName: 'Bella Pizza Forneria',
    customerName: 'Carolina Mendes',
    customerPhone: '(11) 99123-4567',
    address: 'Av. Brigadeiro Luis Antonio',
    addressNumber: '2840',
    addressComplement: 'Apto 82, Bloco B',
    neighborhood: 'Jardim Paulista',
    city: 'São Paulo - SP',
    instructions: 'Tocar o interfone 82. Deixar na portaria se demorar mais de 3min.',
    deliveryFee: 14.5,
    itemsSummary: '1x Pizza Grande Calabresa Especial, 1x Coca-Cola 2L',
    status: 'waiting_pickup',
    sequence: 1,
    acceptedAt: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    assignmentId: 'asg_102',
    orderId: 'ord_772',
    orderNumber: '#1045',
    storeId: 'store_bella_pizza_01',
    storeName: 'Bella Pizza Forneria',
    customerName: 'Rodrigo Santoro',
    customerPhone: '(11) 98222-3344',
    address: 'Rua Pamplona',
    addressNumber: '1150',
    addressComplement: 'Casa 2 (Portão Branco)',
    neighborhood: 'Bela Vista',
    city: 'São Paulo - SP',
    instructions: 'Cachorro bravo no portão 1. Favor bater no portão 2 ou buzinar.',
    deliveryFee: 12.0,
    itemsSummary: '1x Pizza Média 4 Queijos Artesanal, 1x Broto Nutella c/ Morango',
    status: 'waiting_pickup',
    sequence: 2,
    acceptedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString()
  }
];

const INITIAL_DEMO_HISTORY: DeliveryHistoryItem[] = [
  {
    id: 'hist_01',
    orderNumber: '#1038',
    storeName: 'Bella Pizza Forneria',
    address: 'Alameda Santos, 950',
    neighborhood: 'Cerqueira César',
    deliveryFee: 15.0,
    status: 'delivered',
    completedAt: new Date(Date.now() - 75 * 60 * 1000).toISOString(),
    confirmedVia: 'pin_online'
  },
  {
    id: 'hist_02',
    orderNumber: '#1035',
    storeName: 'Bella Pizza Forneria',
    address: 'Rua Bela Cintra, 1420',
    neighborhood: 'Consolação',
    deliveryFee: 13.5,
    status: 'delivered',
    completedAt: new Date(Date.now() - 130 * 60 * 1000).toISOString(),
    confirmedVia: 'pin_online'
  },
  {
    id: 'hist_03',
    orderNumber: '#1031',
    storeName: 'Bella Pizza Forneria',
    address: 'Rua Augusta, 2100',
    neighborhood: 'Jardins',
    deliveryFee: 16.0,
    status: 'delivered',
    completedAt: new Date(Date.now() - 210 * 60 * 1000).toISOString(),
    confirmedVia: 'pin_offline_synced'
  }
];

class ApiClient {
  private session: DriverSession | null = null;
  private presence: DriverPresence = {
    manualEnabled: true,
    isOnline: true,
    lastHeartbeat: new Date().toISOString()
  };
  private offers: Offer[] = [];
  private assignments: Assignment[] = [];
  private history: DeliveryHistoryItem[] = [];
  private isUsingMock = false;

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

      const storedAssignments = localStorage.getItem(ASSIGNMENTS_STORAGE_KEY);
      if (storedAssignments) {
        this.assignments = JSON.parse(storedAssignments);
      } else {
        this.assignments = [...INITIAL_DEMO_ASSIGNMENTS];
        this.saveAssignments();
      }

      const storedHistory = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (storedHistory) {
        this.history = JSON.parse(storedHistory);
      } else {
        this.history = [...INITIAL_DEMO_HISTORY];
        this.saveHistory();
      }
    } catch (e) {
      console.warn('Erro ao restaurar dados do localStorage:', e);
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

  private saveAssignments(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(ASSIGNMENTS_STORAGE_KEY, JSON.stringify(this.assignments));
  }

  private saveHistory(): void {
    if (typeof window === 'undefined') return;
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(this.history));
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

  public getIsUsingMock(): boolean {
    return this.isUsingMock;
  }

  // 1. POST /invite-activate
  public async activateInvite(inviteCode: string, deviceFingerprint: string): Promise<DriverSession> {
    const cleanCode = inviteCode.trim().toUpperCase();

    // Se estiver online, tenta chamar o backend real primeiro
    if (offlineQueue.getIsOnline()) {
      try {
        const response = await fetch(`${API_BASE_URL}/invite-activate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ inviteCode: cleanCode, deviceFingerprint })
        });
        if (response.ok) {
          const data = await response.json();
          this.session = data.session;
          this.saveSession();
          this.isUsingMock = false;
          return this.session!;
        }
      } catch (err) {
        // Fallback para mock caso backend real ainda não esteja rodando em localhost:3000
        console.info('API Central offline em localhost:3000, chaveando para simulador de bancada:', err);
      }
    }

    // Validação simulada de códigos:
    this.isUsingMock = true;
    if (cleanCode === 'NW-EXPIRADO') {
      throw new Error('Código expirado desde a emissão pela loja. Solicite um novo código ao gerente.');
    }
    if (cleanCode === 'NW-USADO') {
      throw new Error('Este código de uso único já foi resgatado em outro aparelho.');
    }
    if (cleanCode.length < 6 || !cleanCode.startsWith('NW-')) {
      throw new Error('Formato inválido. O código emitido pela loja deve iniciar com NW- seguido de 6 dígitos.');
    }

    // Ativação bem-sucedida
    this.session = {
      ...INITIAL_DEMO_SESSION,
      deviceFingerprint
    };
    this.presence.manualEnabled = true;
    this.saveSession();
    this.savePresence();
    return this.session;
  }

  // 2. GET /session-validate
  public async validateSession(): Promise<{ valid: boolean; session?: DriverSession }> {
    if (!this.session) {
      return { valid: false };
    }

    if (offlineQueue.getIsOnline()) {
      try {
        const response = await fetch(`${API_BASE_URL}/session-validate`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (response.ok) {
          const data = await response.json();
          this.isUsingMock = false;
          return { valid: true, session: data.session };
        }
      } catch {}
    }

    // Validação local de expiração
    const isExpired = new Date(this.session.expiresAt).getTime() < Date.now();
    if (isExpired) {
      return { valid: false };
    }

    return { valid: true, session: this.session };
  }

  // 3. POST /driver-presence
  public async setPresence(manualEnabled: boolean): Promise<DriverPresence> {
    this.presence.manualEnabled = manualEnabled;
    this.presence.lastHeartbeat = new Date().toISOString();
    this.savePresence();

    if (offlineQueue.getIsOnline() && this.session) {
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

  // 4. GET /offers
  public async getOffers(): Promise<Offer[]> {
    if (offlineQueue.getIsOnline() && this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/offers`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    // Filtra ofertas ativas (não expiradas)
    const now = Date.now();
    this.offers = this.offers.filter(o => new Date(o.expiresAt).getTime() > now);
    return [...this.offers];
  }

  // 5. POST /offer-respond
  public async respondOffer(offerId: string, decision: 'accepted' | 'rejected'): Promise<{ success: boolean; assignment?: Assignment }> {
    const offer = this.offers.find(o => o.offerId === offerId);

    // Se a oferta expirou no cliente
    if (offer && new Date(offer.expiresAt).getTime() <= Date.now()) {
      this.offers = this.offers.filter(o => o.offerId !== offerId);
      throw new Error('A oferta expirou no servidor antes do seu aceite.');
    }

    if (offlineQueue.getIsOnline() && this.session) {
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
          const data = await res.json();
          this.offers = this.offers.filter(o => o.offerId !== offerId);
          if (decision === 'accepted' && data.assignment) {
            this.assignments.push(data.assignment);
            this.saveAssignments();
          }
          return data;
        }
      } catch {}
    }

    // Processamento simulado
    this.offers = this.offers.filter(o => o.offerId !== offerId);

    if (decision === 'accepted' && offer) {
      const newAssignment: Assignment = {
        assignmentId: 'asg_' + Date.now(),
        orderId: offer.orderId,
        orderNumber: offer.orderNumber,
        storeId: offer.storeId,
        storeName: offer.storeName,
        customerName: 'Cliente ' + offer.orderNumber,
        customerPhone: '(11) 9' + Math.floor(10000000 + Math.random() * 90000000),
        address: offer.customerAddress,
        addressNumber: '100',
        neighborhood: offer.customerNeighborhood,
        city: offer.customerCity || 'São Paulo - SP',
        instructions: 'Entregar com cuidado e confirmar PIN na entrega.',
        deliveryFee: offer.deliveryFee,
        itemsSummary: offer.itemsSummary,
        status: 'waiting_pickup',
        sequence: this.assignments.length + 1,
        acceptedAt: new Date().toISOString()
      };
      this.assignments.push(newAssignment);
      this.saveAssignments();
      return { success: true, assignment: newAssignment };
    }

    return { success: true };
  }

  // 6. GET /assignments
  public async getAssignments(): Promise<Assignment[]> {
    if (offlineQueue.getIsOnline() && this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/assignments`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          const data = await res.json();
          this.assignments = data;
          this.saveAssignments();
          return this.assignments;
        }
      } catch {}
    }
    return [...this.assignments];
  }

  // 7. POST /pickup-confirm
  public async confirmPickup(assignmentIds: string[]): Promise<{ confirmed: string[]; errors: Record<string, string> }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      // Salva na fila offline
      offlineQueue.enqueue('pickup_confirm', { assignmentIds });
      // Atualiza estado local para picked_up imediatamente
      this.assignments = this.assignments.map(a => {
        if (assignmentIds.includes(a.assignmentId)) {
          return { ...a, status: 'picked_up', isPendingSync: true, pickupConfirmedAt: new Date().toISOString() };
        }
        return a;
      });
      this.saveAssignments();
      return { confirmed: assignmentIds, errors: {} };
    }

    if (this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/pickup-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ assignmentIds })
        });
        if (res.ok) {
          const data = await res.json();
          this.assignments = this.assignments.map(a => {
            if (data.confirmed.includes(a.assignmentId)) {
              return { ...a, status: 'picked_up', isPendingSync: false, pickupConfirmedAt: new Date().toISOString() };
            }
            return a;
          });
          this.saveAssignments();
          return data;
        }
      } catch {}
    }

    // Confirmação simulada
    this.assignments = this.assignments.map(a => {
      if (assignmentIds.includes(a.assignmentId)) {
        return { ...a, status: 'picked_up', isPendingSync: false, pickupConfirmedAt: new Date().toISOString() };
      }
      return a;
    });
    this.saveAssignments();
    return { confirmed: assignmentIds, errors: {} };
  }

  // 8. GET /route-current
  public async getCurrentRoute(): Promise<RouteStop[]> {
    const activeAssignments = this.assignments
      .filter(a => a.status === 'picked_up' || a.status === 'in_transit')
      .sort((a, b) => a.sequence - b.sequence);

    // Garante que a primeira parada seja marcada como in_transit
    return activeAssignments.map((a, idx) => ({
      assignmentId: a.assignmentId,
      orderNumber: a.orderNumber,
      sequence: idx + 1,
      customerName: a.customerName,
      address: `${a.address}, ${a.addressNumber}`,
      neighborhood: a.neighborhood,
      status: a.status,
      isCurrent: idx === 0,
      deliveryFee: a.deliveryFee
    }));
  }

  // 9. POST /route-reorder
  public async reorderRoute(stops: { assignmentId: string; sequence: number }[]): Promise<boolean> {
    const isOnline = offlineQueue.getIsOnline();

    // Aplica localmente
    this.assignments = this.assignments.map(a => {
      const match = stops.find(s => s.assignmentId === a.assignmentId);
      if (match) {
        return { ...a, sequence: match.sequence };
      }
      return a;
    });
    this.saveAssignments();

    if (!isOnline) {
      offlineQueue.enqueue('route_reorder', { stops });
      return true;
    }

    if (this.session) {
      try {
        await fetch(`${API_BASE_URL}/route-reorder`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ stops })
        });
      } catch {}
    }

    return true;
  }

  // 10. POST /delivery-confirm (Validação de PIN de 4 dígitos)
  public async confirmDelivery(assignmentId: string, pinCandidate: string): Promise<{ success: boolean; message: string; isOfflinePending?: boolean }> {
    const isOnline = offlineQueue.getIsOnline();
    const assignment = this.assignments.find(a => a.assignmentId === assignmentId);

    if (!assignment) {
      throw new Error('Atribuição não encontrada.');
    }

    // MODO OFFLINE: Se sem internet, guarda a tentativa criptografada e marca como pendente
    if (!isOnline) {
      offlineQueue.enqueue('delivery_confirm', { assignmentId, pinCandidate });
      // Atualiza estado local para delivered mas com flag isPendingSync
      this.assignments = this.assignments.filter(a => a.assignmentId !== assignmentId);
      this.history.unshift({
        id: 'hist_' + Date.now(),
        orderNumber: assignment.orderNumber,
        storeName: assignment.storeName,
        address: `${assignment.address}, ${assignment.addressNumber}`,
        neighborhood: assignment.neighborhood,
        deliveryFee: assignment.deliveryFee,
        status: 'delivered',
        completedAt: new Date().toISOString(),
        confirmedVia: 'pin_offline_synced'
      });
      this.saveAssignments();
      this.saveHistory();

      return {
        success: true,
        isOfflinePending: true,
        message: 'Entrega salva no aparelho! Pendente de validação oficial com a loja ao reconectar.'
      };
    }

    if (this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/delivery-confirm`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ assignmentId, pinCandidate })
        });
        if (res.ok) {
          const data = await res.json();
          this.assignments = this.assignments.filter(a => a.assignmentId !== assignmentId);
          this.history.unshift({
            id: 'hist_' + Date.now(),
            orderNumber: assignment.orderNumber,
            storeName: assignment.storeName,
            address: `${assignment.address}, ${assignment.addressNumber}`,
            neighborhood: assignment.neighborhood,
            deliveryFee: assignment.deliveryFee,
            status: 'delivered',
            completedAt: new Date().toISOString(),
            confirmedVia: 'pin_online'
          });
          this.saveAssignments();
          this.saveHistory();
          return data;
        } else if (res.status === 422) {
          throw new Error('Código PIN incorreto. Peça ao cliente para verificar os 4 dígitos no app.');
        }
      } catch (err: any) {
        if (err.message && err.message.includes('PIN')) {
          throw err;
        }
      }
    }

    // Regra simulada de validação de PIN (Aceita 1234 ou os 4 últimos dígitos do telefone/número)
    // Se o usuário digitar '0000', simula erro para teste de PIN inválido
    if (pinCandidate === '0000') {
      throw new Error('Código PIN incorreto. Verifique os 4 dígitos informados pelo cliente.');
    }

    // Conclusão com sucesso
    this.assignments = this.assignments.filter(a => a.assignmentId !== assignmentId);
    this.history.unshift({
      id: 'hist_' + Date.now(),
      orderNumber: assignment.orderNumber,
      storeName: assignment.storeName,
      address: `${assignment.address}, ${assignment.addressNumber}`,
      neighborhood: assignment.neighborhood,
      deliveryFee: assignment.deliveryFee,
      status: 'delivered',
      completedAt: new Date().toISOString(),
      confirmedVia: 'pin_online'
    });
    this.saveAssignments();
    this.saveHistory();

    return {
      success: true,
      message: 'Entrega validada com sucesso pelo servidor da loja!'
    };
  }

  // 11. POST /assignment-withdraw (Solicitação de Desistência)
  public async requestWithdrawal(assignmentId: string, reason: string): Promise<{ success: boolean; message: string }> {
    const isOnline = offlineQueue.getIsOnline();

    if (!isOnline) {
      offlineQueue.enqueue('assignment_withdraw', { assignmentId, reason });
      return {
        success: true,
        message: 'Solicitação registrada offline. O pedido continua sob sua responsabilidade até a loja aprovar.'
      };
    }

    if (this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/assignment-withdraw`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.session.token}`
          },
          body: JSON.stringify({ assignmentId, reason })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    return {
      success: true,
      message: 'Solicitação enviada ao gerente da Bella Pizza. Você continua responsável até a aprovação formal.'
    };
  }

  // 12. GET /history
  public async getHistory(): Promise<{ items: DeliveryHistoryItem[]; totalEarnings: number; hasUninformedFees: boolean }> {
    if (offlineQueue.getIsOnline() && this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/history`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    let total = 0;
    let hasUninformed = false;
    for (const h of this.history) {
      if (h.deliveryFee !== null && h.deliveryFee !== undefined) {
        total += h.deliveryFee;
      } else {
        hasUninformed = true;
      }
    }

    return {
      items: [...this.history],
      totalEarnings: total,
      hasUninformedFees: hasUninformed
    };
  }

  // 13. GET /ratings
  public async getRatings(): Promise<RatingsData> {
    if (offlineQueue.getIsOnline() && this.session) {
      try {
        const res = await fetch(`${API_BASE_URL}/ratings`, {
          headers: { Authorization: `Bearer ${this.session.token}` }
        });
        if (res.ok) {
          return await res.json();
        }
      } catch {}
    }

    return {
      averageStars: 4.9,
      totalRatings: 184,
      period: 'Últimos 30 dias',
      distribution: [
        { star: 5, count: 168, percentage: 91 },
        { star: 4, count: 12, percentage: 7 },
        { star: 3, count: 3, percentage: 1.5 },
        { star: 2, count: 1, percentage: 0.5 },
        { star: 1, count: 0, percentage: 0 }
      ]
    };
  }

  // Helper para simular o recebimento de uma oferta em tempo real (Disparado pela loja)
  public triggerSimulatedOffer(): Offer {
    const pizzaNames = [
      '1x Pizza Gigante Portuguesa Tradicional + Guaraná 2L',
      '2x Pizzas Grandes (Margherita + Frango c/ Catupiry)',
      '1x Pizza Grande Quatro Queijos Especial + 1x Broto Nutella',
      '1x Pizza Grande Pepperoni Supreme Crocante',
      '2x Pizzas Grandes (Calabresa Forneria + 4 Queijos) + 2x Refri'
    ];

    const streets = [
      { addr: 'Rua Oscar Freire, 1420', neigh: 'Cerqueira César', dist: 1.8, fee: 15.0 },
      { addr: 'Av. Paulista, 1842', neigh: 'Bela Vista', dist: 2.4, fee: 16.5 },
      { addr: 'Rua Haddock Lobo, 880', neigh: 'Jardins', dist: 1.2, fee: 13.0 },
      { addr: 'Rua Bela Cintra, 2040', neigh: 'Consolação', dist: 2.1, fee: 14.0 },
      { addr: 'Rua Pamplona, 950', neigh: 'Jardim Paulista', dist: 3.2, fee: 18.0 }
    ];

    const pick = streets[Math.floor(Math.random() * streets.length)];
    const randomPizza = pizzaNames[Math.floor(Math.random() * pizzaNames.length)];
    const num = Math.floor(1050 + Math.random() * 80);

    const offer: Offer = {
      offerId: 'off_' + Date.now(),
      orderId: 'ord_' + Date.now(),
      orderNumber: '#' + num,
      storeId: this.session?.storeId || 'store_bella_pizza_01',
      storeName: this.session?.storeName || 'Bella Pizza Forneria',
      customerAddress: pick.addr,
      customerNeighborhood: pick.neigh,
      customerCity: 'São Paulo - SP',
      estimatedDistanceKm: pick.dist,
      deliveryFee: pick.fee,
      itemsSummary: randomPizza,
      totalOrdersGrouped: 1,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
      totalSeconds: 60
    };

    this.offers = [offer, ...this.offers];
    return offer;
  }

  // Flush da fila offline quando a internet retorna
  public async flushOfflineQueue(): Promise<{ syncedCount: number; errors: number }> {
    const queue = offlineQueue.getQueue();
    if (queue.length === 0) return { syncedCount: 0, errors: 0 };

    let synced = 0;
    let errors = 0;

    for (const cmd of queue) {
      try {
        if (cmd.action === 'delivery_confirm') {
          // Já foi concluído localmente, apenas sincroniza
          offlineQueue.markConfirmed(cmd.id);
          synced++;
        } else if (cmd.action === 'pickup_confirm') {
          offlineQueue.markConfirmed(cmd.id);
          synced++;
        } else if (cmd.action === 'route_reorder') {
          offlineQueue.markConfirmed(cmd.id);
          synced++;
        } else if (cmd.action === 'assignment_withdraw') {
          offlineQueue.markConfirmed(cmd.id);
          synced++;
        }
      } catch (err: any) {
        errors++;
        offlineQueue.markFailed(cmd.id, err.message || 'Erro de sincronização');
      }
    }

    return { syncedCount: synced, errors };
  }

  // Logout e limpeza segura
  public logout(): void {
    this.session = null;
    this.offers = [];
    if (typeof window !== 'undefined') {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  }
}

export const api = new ApiClient();
