import React, { useRef, useState } from 'react';
import type { Assignment, OptimizedRouteResult } from '../types';
import { assignmentKey } from '../services/pickupRouteState';
import './RouteExperience.css';

export const routeAddress = (stop: Assignment) => [stop.address, stop.addressNumber, stop.neighborhood, stop.city].filter(Boolean).join(', ');

export function projectRoutePoints(stops: Assignment[], suggestion?: OptimizedRouteResult | null) {
  const points = stops.flatMap((stop, index) => {
    const metric = suggestion?.stops.find(item => item.assignmentId === assignmentKey(stop));
    const coordinate = metric?.destinationCoordinates;
    if (!coordinate || !Number.isFinite(coordinate.latitude) || Math.abs(coordinate.latitude) > 90 || !Number.isFinite(coordinate.longitude) || Math.abs(coordinate.longitude) > 180) return [];
    return [{ latitude: coordinate.latitude, longitude: coordinate.longitude, sequence: index + 1, approximate: !!metric?.locationApproximate }];
  });
  if (points.length < 2) return [];
  const reference = points[0].longitude;
  const latitudeScale = Math.cos(points.reduce((sum, point) => sum + point.latitude, 0) / points.length * Math.PI / 180);
  const projected = points.map(point => ({ ...point, x: (((point.longitude - reference + 540) % 360) - 180) * latitudeScale, y: -point.latitude }));
  const minX = Math.min(...projected.map(point => point.x)), maxX = Math.max(...projected.map(point => point.x));
  const minY = Math.min(...projected.map(point => point.y)), maxY = Math.max(...projected.map(point => point.y));
  const scale = Math.min(272 / (maxX - minX || 1e-9), 112 / (maxY - minY || 1e-9));
  return projected.map(point => ({ ...point, x: 160 + (point.x - (minX + maxX) / 2) * scale, y: 80 + (point.y - (minY + maxY) / 2) * scale }));
}

export function RoutePreview({ stops, pending, suggestion }: { stops: Assignment[]; pending: boolean; suggestion?: OptimizedRouteResult | null }) {
  const points = projectRoutePoints(stops, suggestion);
  return <details className="card-surface route-preview">
    <summary>Prévia da sequência · {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}</summary>
    <p>{pending ? 'Esta sequência ainda não foi salva.' : 'Sequência atual das suas entregas.'} Confira os endereços antes de sair.</p>
    <p className="route-help">A lista mostra a ordem das paradas; abra o mapa para ver o trajeto até cada endereço.</p>
    {points.length >= 2 && <figure className="route-geography">
      <svg viewBox="0 0 320 160" role="img" aria-labelledby="route-geography-title route-geography-description">
        <title id="route-geography-title">Posição geográfica das paradas numeradas</title>
        <desc id="route-geography-description">Ligação ilustrativa entre coordenadas fornecidas pelo cálculo da rota. Não representa ruas, distância ou trajeto viário. Os números correspondem à sequência abaixo.</desc>
        <polyline points={points.map(point => `${point.x},${point.y}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray="5 5" opacity="0.55" />
        {points.map(point => <g key={point.sequence}><circle cx={point.x} cy={point.y} r="12" className={point.approximate ? 'route-point-approximate' : ''} /><text x={point.x} y={point.y + 4} textAnchor="middle">{point.sequence}</text></g>)}
      </svg>
      <figcaption>Posição das paradas · ligação ilustrativa, não é trajeto viário</figcaption>
      {points.length < stops.length && <p>{points.length} de {stops.length} paradas com coordenadas disponíveis.</p>}
      {points.some(point => point.approximate) && <p>Pontos com borda tracejada têm localização aproximada; confira o número do imóvel no endereço.</p>}
    </figure>}
    <ol>{stops.map(stop => <li key={assignmentKey(stop)}><div><strong>{stop.orderNumber}</strong><span>{routeAddress(stop) || 'Endereço não informado pela loja'}</span></div>
      {stop.address?.trim() && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(routeAddress(stop))}`} target="_blank" rel="noopener noreferrer" aria-label={`Abrir mapa do pedido ${stop.orderNumber}`}>Abrir mapa</a>}
    </li>)}</ol>
  </details>;
}

type CardProps = React.HTMLAttributes<HTMLDivElement> & { stop: Assignment; onDetails: () => void };
export function RouteSwipeCard({ stop, onDetails, children, ...props }: CardProps) {
  const [revealed, setRevealed] = useState(false);
  const start = useRef<{ x: number; y: number } | null>(null);
  const menuId = `route-actions-${assignmentKey(stop).replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return <div {...props} style={{ ...props.style, touchAction: 'pan-y' }} onPointerDown={event => {
    if (event.pointerType === 'mouse' || (event.target as HTMLElement).closest('button,a,input,summary')) return;
    start.current = { x: event.clientX, y: event.clientY };
  }} onPointerUp={event => {
    const origin = start.current; start.current = null;
    if (!origin || Math.abs(event.clientY - origin.y) > 32) return;
    const distance = event.clientX - origin.x;
    if (Math.abs(distance) > 56) setRevealed(distance < 0);
  }} onPointerCancel={() => { start.current = null; }} onKeyDown={event => {
    if (event.key === 'Escape') setRevealed(false);
  }}>
    {children}
    <div className="route-swipe-controls">
      <button type="button" aria-expanded={revealed} aria-controls={menuId} onClick={() => setRevealed(value => !value)}>{revealed ? 'Ocultar atalhos' : 'Atalhos desta parada'}</button>
      <span>Deslize para a esquerda para revelar</span>
    </div>
    {revealed && <div id={menuId} className="route-swipe-actions">
      {stop.address?.trim() && <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(routeAddress(stop))}`} target="_blank" rel="noopener noreferrer">Navegar no Maps</a>}
      <button type="button" onClick={onDetails}>Ver detalhes</button>
    </div>}
  </div>;
}
