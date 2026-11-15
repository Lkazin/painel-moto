import type { Assignment, OptimizedRouteResult, TrackingSessionState } from '../types';

export type DeliveryWaitLevel = 'ok' | 'warning' | 'critical';

export interface DeliveryWaitMetrics {
  startedAt: string | null;
  isAtGate: boolean;
  waitMinutes: number;
  targetMinutes: number;
  percent: number;
  barPercent: number;
  level: DeliveryWaitLevel;
  label: string;
}

const DEFAULT_ROUTE_WAIT_TARGET_MINUTES = 30;
const DEFAULT_GATE_WAIT_LIMIT_MINUTES = 5;

function parseWaitTimestamp(value?: string | null): number {
  if (!value) return NaN;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

export function calculateDeliveryWait(
  stop: Partial<Assignment>,
  now = Date.now(),
  overrideCumulativeDurationSeconds?: number | null
): DeliveryWaitMetrics {
  const gateMs = parseWaitTimestamp(stop.waitingGateStartedAt);
  const isAtGate = Number.isFinite(gateMs);

  let startedAt: string | null = isAtGate ? stop.waitingGateStartedAt! : null;
  let startedMs = gateMs;

  if (!isAtGate) {
    const historyPickup = (stop.stageHistory || []).find((entry) =>
      ['picked_up', 'in_transit', 'em_entrega'].includes(String(entry?.stage || entry?.status || '')) &&
      Number.isFinite(parseWaitTimestamp(entry?.at))
    );
    const candidates = [
      stop.pickedUpAt,
      stop.pickupConfirmedAt,
      historyPickup?.at,
      stop.acceptedAt,
      stop.createdAt,
    ];
    for (const candidate of candidates) {
      const ms = parseWaitTimestamp(candidate);
      if (Number.isFinite(ms)) {
        startedAt = candidate!;
        startedMs = ms;
        break;
      }
    }
  }

  const targetMinutes = isAtGate
    ? Math.max(1, (Number(stop.waitingGateLimitMinutes) || DEFAULT_GATE_WAIT_LIMIT_MINUTES) + (Number(stop.gateWaitExtendedMinutes) || 0))
    : (() => {
        const cumulative = overrideCumulativeDurationSeconds ?? stop.routeEstimate?.cumulativeDurationSeconds;
        if (typeof cumulative === 'number' && Number.isFinite(cumulative) && cumulative > 0) {
          return Math.max(20, Math.ceil(cumulative / 60) + 10);
        }
        return DEFAULT_ROUTE_WAIT_TARGET_MINUTES;
      })();

  if (!Number.isFinite(startedMs)) {
    return {
      startedAt: null,
      isAtGate,
      waitMinutes: 0,
      targetMinutes,
      percent: 0,
      barPercent: 0,
      level: 'ok',
      label: isAtGate ? 'No portão' : 'Em rota',
    };
  }

  const elapsedMs = Math.max(0, now - startedMs);
  const waitMinutes = Math.floor(elapsedMs / 60000);
  const percent = Math.min(999, Math.max(0, Math.round((elapsedMs / (targetMinutes * 60000)) * 100)));
  const barPercent = Math.min(100, percent);
  const level: DeliveryWaitLevel = percent >= 90 ? 'critical' : percent >= 60 ? 'warning' : 'ok';

  const label = isAtGate
    ? `${waitMinutes} min no portão`
    : waitMinutes === 0
      ? 'Recém retirada (0 min)'
      : `${waitMinutes} min parada`;

  return {
    startedAt,
    isAtGate,
    waitMinutes,
    targetMinutes,
    percent,
    barPercent,
    level,
    label,
  };
}

export function recentRouteOrigin(state: TrackingSessionState, now = Date.now()) {
  const location = state.lastLocation;
  if (!location || !Number.isFinite(location.timestamp) || now-Number(location.timestamp)>120000 || now<Number(location.timestamp) ||
    !Number.isFinite(location.latitude) || Math.abs(location.latitude)>90 || !Number.isFinite(location.longitude) || Math.abs(location.longitude)>180 ||
    (location.accuracy != null && (!Number.isFinite(location.accuracy) || location.accuracy<0 || location.accuracy>100))) return undefined;
  return {latitude:location.latitude,longitude:location.longitude};
}

export function routeStaleReason(result: OptimizedRouteResult | null, state: TrackingSessionState, now = Date.now()): string | null {
  if (!result) return null;
  const calculated = Date.parse(result.calculatedAt || '');
  if (Number.isFinite(calculated) && now-calculated>300000) return 'O cálculo tem mais de cinco minutos.';
  const current = recentRouteOrigin(state,now);
  if (!current) return null;
  const rad = Math.PI/180;
  const a = Math.sin((current.latitude-result.origin.latitude)*rad/2)**2 +
    Math.cos(current.latitude*rad)*Math.cos(result.origin.latitude*rad)*Math.sin((current.longitude-result.origin.longitude)*rad/2)**2;
  if (6371000*2*Math.atan2(Math.sqrt(a),Math.sqrt(Math.max(0,1-a)))>200) return 'Sua localização mudou desde o cálculo.';
  return null;
}
