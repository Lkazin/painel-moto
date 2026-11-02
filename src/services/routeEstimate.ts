import type { OptimizedRouteResult, TrackingSessionState } from '../types';

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
