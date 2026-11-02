import type { TrackingSessionState } from '../types';

type Permission = 'granted' | 'denied' | 'prompt' | 'unknown';
export interface TrackingPresentation {
  kind: 'offline' | 'denied' | 'paused' | 'waiting' | 'captured' | 'fresh' | 'stale' | 'lost';
  label: string;
  detail: string;
  lastSentAt: number | null;
}

/** A device GPS fix is not evidence that the server received or shared it. */
export function trackingPresentation(state: TrackingSessionState, permission: Permission, online: boolean, now = Date.now(), backgroundGps = false): TrackingPresentation {
  const point = state.lastLocation;
  const capturedAt = Number(point?.timestamp);
  const sentAt = Date.parse(state.lastPushedAt || '');
  const validCapture = Boolean(point && Number.isFinite(capturedAt) && capturedAt <= now + 5000 &&
    Number.isFinite(point.latitude) && Math.abs(point.latitude) <= 90 &&
    Number.isFinite(point.longitude) && Math.abs(point.longitude) <= 180 &&
    (point.accuracy == null || (Number.isFinite(point.accuracy) && point.accuracy >= 0 && point.accuracy <= 100)));
  const captureAge = validCapture ? Math.max(0, now - capturedAt) : Infinity;
  const lastSentAt = Number.isFinite(sentAt) && sentAt <= now + 5000 ? sentAt : null;
  const sendAge = lastSentAt === null ? Infinity : Math.max(0, now - lastSentAt);
  const result = (kind: TrackingPresentation['kind'], label: string, detail: string) => ({ kind, label, detail, lastSentAt });
  if (!online) return result('offline', 'Sem internet', 'O envio está pausado. Uma posição nova será solicitada quando a conexão voltar.');
  if (permission === 'denied') return result('denied', 'Permissão de GPS negada', backgroundGps ? 'Permita a localização precisa e as notificações nas configurações do aplicativo.' : 'Permita a localização nas configurações do navegador para acompanhar a entrega.');
  if (!state.isActive) return result('paused', captureAge <= 30000 ? 'GPS disponível · envio pausado' : 'GPS pausado',
    'A localização só é enviada durante uma entrega com retirada confirmada.');
  if (captureAge > 120000) return result('lost', 'Aguardando sinal de GPS', state.error || (backgroundGps ? 'Não há posição recente. Confira o sinal, as permissões e o aviso de localização do aplicativo.' : 'Não há posição recente. Mantenha a localização permitida e o aplicativo aberto.'));
  if (captureAge > 30000) return result('stale', 'Sinal GPS desatualizado', state.error || 'A última captura tem mais de 30 segundos. Aguardando uma posição nova.');
  if (state.error) return result('stale', 'GPS precisa de atenção', state.error);
  if (lastSentAt === null) return result('captured', 'GPS capturado · aguardando envio', 'Há uma posição no aparelho, mas o servidor ainda não confirmou o recebimento.');
  if (sendAge > 120000) return result('lost', 'Sem envio recente de GPS', 'Há uma captura no aparelho, mas o último envio confirmado tem mais de 2 minutos.');
  if (sendAge > 30000) return result('stale', 'Envio GPS desatualizado', 'O último envio confirmado tem mais de 30 segundos. Aguardando sincronização.');
  return result('fresh', 'GPS enviado e confirmado', backgroundGps ? 'O servidor confirmou uma posição recente. O GPS pode continuar ao abrir o Waze enquanto a entrega estiver ativa.' : 'O servidor confirmou uma posição recente. A captura depende do sinal e do navegador.');
}
