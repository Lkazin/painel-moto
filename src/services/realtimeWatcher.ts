import { logisticsApiUrl } from './logisticsConfig';

/**
 * Assinatura do canal de tempo real do entregador.
 *
 * Antes o app perguntava a cada 3,5 s se havia oferta nova. Agora ele assina o
 * tópico opaco da própria loja (obtido em /api/v1/realtime-topic com a sessão
 * do entregador) e só consulta quando a loja avisa que algo mudou.
 *
 * O payload do broadcast traz apenas a revisão do estado — nenhum dado de
 * pedido, endereço ou cliente passa por aqui. Os dados continuam vindo de
 * /api/v1/logistics com o token do entregador.
 */

type Listener = () => void;

interface TopicResponse {
  success?: boolean;
  topic?: string;
}

interface SocketLike {
  close: () => void;
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
  onclose: (() => void) | null;
  onopen: (() => void) | null;
}

interface ChannelLike {
  on: (type: string, filter: Record<string, unknown>, callback: () => void) => ChannelLike;
  subscribe: (callback?: (status: string) => void) => ChannelLike;
  unsubscribe: () => Promise<unknown> | unknown;
}

export interface RealtimeClientLike {
  channel: (name: string, options?: Record<string, unknown>) => ChannelLike;
}

export type RealtimeStatus = 'idle' | 'connecting' | 'live' | 'offline';

function websocketUrl(apiKey: string): string {
  const base = logisticsApiUrl().replace('/api/v1/logistics', '');
  const url = new URL(base);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = '/realtime/v1/websocket';
  url.search = `apikey=${encodeURIComponent(apiKey)}&vsn=1.0.0`;
  return url.toString();
}

/** Transporte mínimo do protocolo Realtime do Supabase (phoenix), sem dependências. */
export function createSocketTransport(apiKey: string, url = websocketUrl(apiKey)): RealtimeClientLike {
  return {
    channel(topic: string) {
      let socket: SocketLike | null = null;
      let ref = 0;
      let joined = false;
      let closed = false;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let listener: Listener | null = null;

      const send = (payload: Record<string, unknown>) => {
        try {
          (socket as unknown as { send: (data: string) => void })?.send(JSON.stringify(payload));
        } catch {
          /* reconexão cuida disso */
        }
      };

      const connect = () => {
        if (closed || typeof WebSocket === 'undefined') return;
        try {
          socket = new WebSocket(url) as unknown as SocketLike;
        } catch {
          return;
        }
        socket.onopen = () => {
          ref += 1;
          send({ topic, event: 'phx_join', payload: { config: { broadcast: { self: false } } }, ref: String(ref) });
        };
        socket.onmessage = (event) => {
          let message: any;
          try {
            message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
          } catch {
            return;
          }
          if (message?.event === 'phx_reply' && message?.payload?.status === 'ok') joined = true;
          if (message?.event === 'broadcast' && message?.payload?.event === 'updated') {
            try {
              listener?.();
            } catch {
              /* um listener com erro não pode derrubar a conexão */
            }
          }
        };
        socket.onerror = () => { /* o onclose decide a reconexão */ };
        socket.onclose = () => {
          joined = false;
          if (closed) return;
          // Backoff simples: o app também tem a consulta lenta de segurança.
          setTimeout(connect, 5000);
        };
        if (!heartbeat) {
          heartbeat = setInterval(() => send({ topic, event: 'heartbeat', payload: {}, ref: String(++ref) }), 25000);
        }
      };

      connect();

      return {
        on(_type: string, _filter: Record<string, unknown>, callback: () => void) {
          listener = callback;
          return this;
        },
        subscribe(callback?: (status: string) => void) {
          callback?.(joined ? 'SUBSCRIBED' : 'SUBSCRIBING');
          return this;
        },
        unsubscribe() {
          closed = true;
          if (heartbeat) clearInterval(heartbeat);
          heartbeat = null;
          try {
            socket?.close();
          } catch {
            /* já fechado */
          }
          return Promise.resolve('ok');
        },
      };
    },
  };
}

export class RealtimeWatcher {
  private client: RealtimeClientLike | null = null;
  private channel: ChannelLike | null = null;
  private token = '';
  private listeners = new Set<Listener>();
  private statusListeners = new Set<(status: RealtimeStatus) => void>();
  private status: RealtimeStatus = 'idle';
  private fallbackTimer: ReturnType<typeof setInterval> | null = null;
  private fetchTopic: () => Promise<TopicResponse>;
  private options: { slowPollMs?: number; createClient?: (apiKey: string) => RealtimeClientLike };

  constructor(
    fetchTopic: () => Promise<TopicResponse>,
    options: { slowPollMs?: number; createClient?: (apiKey: string) => RealtimeClientLike } = {}
  ) {
    this.fetchTopic = fetchTopic;
    this.options = options;
  }

  getStatus(): RealtimeStatus {
    return this.status;
  }

  onUpdate(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onStatus(listener: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(listener);
    listener(this.status);
    return () => this.statusListeners.delete(listener);
  }

  private setStatus(status: RealtimeStatus) {
    if (this.status === status) return;
    this.status = status;
    for (const listener of this.statusListeners) {
      try {
        listener(status);
      } catch {
        /* ignora */
      }
    }
  }

  /** Consulta lenta de segurança: cobre broadcast perdido, app em segundo plano e rede instável. */
  private startFallback() {
    if (this.fallbackTimer || !this.options.slowPollMs) return;
    this.fallbackTimer = setInterval(() => this.emit(), this.options.slowPollMs);
  }

  private emit() {
    for (const listener of this.listeners) {
      try {
        listener();
      } catch {
        /* ignora */
      }
    }
  }

  async connect(sessionToken: string) {
    if (!sessionToken) return;
    if (this.token === sessionToken && this.status === 'live') return;
    await this.disconnect();
    this.token = sessionToken;
    this.setStatus('connecting');
    this.startFallback();
    try {
      const data = await this.fetchTopic();
      const topic = data?.topic;
      const apiKey = (import.meta.env?.VITE_SUPABASE_ANON_KEY as string | undefined) || '';
      if (!topic || !apiKey) {
        // Sem chave anônima configurada o app segue na consulta lenta, sem quebrar.
        this.setStatus('offline');
        return;
      }
      this.client = this.options.createClient ? this.options.createClient(apiKey) : createSocketTransport(apiKey);
      this.channel = this.client.channel(topic, { config: { broadcast: { self: false } } })
        .on('broadcast', { event: 'updated' }, () => this.emit())
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') this.setStatus('live');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.setStatus('offline');
        });
    } catch {
      this.setStatus('offline');
    }
  }

  async disconnect() {
    this.token = '';
    if (this.fallbackTimer) clearInterval(this.fallbackTimer);
    this.fallbackTimer = null;
    try {
      await this.channel?.unsubscribe();
    } catch {
      /* ignora */
    }
    this.channel = null;
    this.client = null;
    this.setStatus('idle');
  }
}

export const realtimeWatcher = new RealtimeWatcher(
  async () => {
    const response = await fetch(logisticsApiUrl().replace('/api/v1/logistics', '/api/v1/realtime-topic'), {
      headers: { 'x-session-token': realtimeToken(), 'Content-Type': 'application/json' },
      cache: 'no-store',
    });
    if (!response.ok) return { success: false };
    return response.json();
  },
  { slowPollMs: 60_000 }
);

let currentToken = '';
function realtimeToken() {
  return currentToken;
}
export function setRealtimeToken(token: string) {
  currentToken = token;
}
