import React, { useState, useEffect, useRef } from 'react';
import {
  Navigation,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckCircle,
  MapPin,
  Clock,
  ArrowRight,
  ShieldAlert,
  AlertCircle,
  Sparkles,
  Compass,
  MessageCircle,
  Map
} from 'lucide-react';
import { Assignment, OptimizedRouteResult, RouteOptimizationMode } from '../types';
import { api } from '../services/api';
import { activeRouteAssignments, assignmentKey, reconcileRouteStops, mapOptimizedStops } from '../services/pickupRouteState';
import { audioAlert } from '../utils/audioAlert';
import { trackingService } from '../services/trackingService';
import TrackingBadge from './TrackingBadge';
import {recentRouteOrigin,routeStaleReason} from '../services/routeEstimate';
import { RoutePreview, RouteSwipeCard } from './RouteExperience';

interface ScreenRouteProps {
  assignments: Assignment[];
  onReorder: (newOrder: { assignmentId: string; sequence: number }[]) => Promise<void>;
  onSelectDelivery: (assignment: Assignment) => void;
  onNavigateToOrders: () => void;
}

export const ScreenRoute: React.FC<ScreenRouteProps> = ({
  assignments,
  onReorder,
  onSelectDelivery,
  onNavigateToOrders
}) => {
  const [stops, setStops] = useState<Assignment[]>(() => activeRouteAssignments(assignments));
  const [hasChanges, setHasChanges] = useState(false);
  const [undoOrder, setUndoOrder] = useState<{ ids: string[]; hadChanges: boolean; routeIds: string } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeMode, setRouteMode] = useState<RouteOptimizationMode>('shortest_distance');
  const [routeError, setRouteError] = useState('');
  const [suggestion, setSuggestion] = useState<OptimizedRouteResult | null>(null);
  const [routeNow,setRouteNow] = useState(Date.now());
  const [tracking,setTracking] = useState(trackingService.getState());
  useEffect(()=>trackingService.subscribe(setTracking),[]);
  useEffect(()=>{if(!suggestion)return;const timer=setInterval(()=>setRouteNow(Date.now()),15000);return()=>clearInterval(timer);},[!!suggestion]);
  const staleReason = routeStaleReason(suggestion,tracking,routeNow);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const assignmentsRef = useRef(assignments);
  const hasChangesRef = useRef(hasChanges);
  const requestRevision = useRef(0);
  const routeIds = JSON.stringify(activeRouteAssignments(assignments).map(a=>[assignmentKey(a),a.address,a.addressNumber,a.neighborhood,a.city]).sort((a,b)=>a[0].localeCompare(b[0])));
  const previousRouteIds = useRef(routeIds);
  assignmentsRef.current = assignments;
  hasChangesRef.current = hasChanges;

  useEffect(() => {
    setStops(previous => reconcileRouteStops(previous,assignments,hasChangesRef.current));
    if (previousRouteIds.current !== routeIds) {requestRevision.current++;setIsOptimizing(false);setSuggestion(null);setUndoOrder(null);previousRouteIds.current = routeIds;}
  },[assignments,routeIds]);
  useEffect(() => () => {requestRevision.current++;},[]);

  const handleOptimizeRoute = async (mode: RouteOptimizationMode) => {
    if (!stops.length || isOptimizing || isSaving) return;
    const revision = ++requestRevision.current;
    setSuggestion(null); setIsOptimizing(true); setRouteError(''); audioAlert.playClickSound();
    try {
      const origin = recentRouteOrigin(trackingService.getState());
      const result = await api.getOptimizeRoute(mode,origin);
      if (revision !== requestRevision.current) return;
      const optimized = mapOptimizedStops(result,assignmentsRef.current);
      setUndoOrder({ ids: stops.map(assignmentKey), hadChanges: hasChanges, routeIds });
      setStops(optimized); setHasChanges(true); setSuggestion({...result,calculatedAt:result.calculatedAt || new Date().toISOString()}); setRouteNow(Date.now()); audioAlert.playSuccessSound();
    } catch(error) {
      if (revision !== requestRevision.current) return;
      const message = error instanceof Error ? error.message : (typeof error === 'object' && error && 'message' in error) ? String((error as any).message) : 'Não foi possível calcular a rota.';
      setRouteError(`${message} Você pode usar as setas para organizar e abrir cada entrega no Maps ou Waze.`);
      audioAlert.playErrorSound();
    } finally {if (revision === requestRevision.current)setIsOptimizing(false);}
  };

  const getFullAddress = (stop: Assignment) => {
    return `${stop.address}, ${stop.addressNumber || ''}, ${stop.neighborhood || ''}, ${stop.city || ''}`;
  };

  const handleOpenWaze = (e: React.MouseEvent, stop: Assignment) => {
    e.stopPropagation();
    audioAlert.playClickSound();
    const encoded = encodeURIComponent(getFullAddress(stop));
    window.open(`https://waze.com/ul?q=${encoded}&navigate=yes`, '_blank');
  };

  const handleOpenGoogleMaps = (e: React.MouseEvent, stop: Assignment) => {
    e.stopPropagation();
    audioAlert.playClickSound();
    const encoded = encodeURIComponent(getFullAddress(stop));
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${encoded}`, '_blank');
  };

  const handleOpenWhatsApp = (e: React.MouseEvent, stop: Assignment) => {
    e.stopPropagation();
    audioAlert.playClickSound();
    const rawPhone = (stop.customerPhone || '').replace(/\D/g, '');
    if (!rawPhone) return;
    const msg = encodeURIComponent(`Olá ${stop.customerName || 'Cliente'}! Sou o entregador da Bella Pizza e estou a caminho do seu pedido #${stop.orderNumber}.`);
    window.open(`https://wa.me/55${rawPhone}?text=${msg}`, '_blank');
  };

  // Reordenação por setas Subir/Descer
  const moveStop = (index: number, direction: 'up' | 'down') => {
    if (isSaving) return;
    requestRevision.current++; setIsOptimizing(false); setSuggestion(null); setRouteError('');
    audioAlert.playClickSound();
    const newStops = [...stops];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newStops.length) return;
    setUndoOrder({ ids: stops.map(assignmentKey), hadChanges: hasChanges, routeIds });

    const temp = newStops[index];
    newStops[index] = newStops[targetIndex];
    newStops[targetIndex] = temp;

    setStops(newStops);
    setHasChanges(true);
  };

  // Suporte a Arrastar e Soltar (HTML5 Drag & Drop)
  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (isSaving || draggedIndex === null || draggedIndex === targetIndex) return;

    requestRevision.current++; setIsOptimizing(false); setSuggestion(null); setRouteError('');
    const newStops = [...stops];
    const [removed] = newStops.splice(draggedIndex, 1);
    newStops.splice(targetIndex, 0, removed);
    setUndoOrder({ ids: stops.map(assignmentKey), hadChanges: hasChanges, routeIds });

    setStops(newStops);
    setHasChanges(true);
    setDraggedIndex(null);
    audioAlert.playClickSound();
  };

  const handleSaveOrder = async () => {
    if (isSaving || isOptimizing) return;
    setUndoOrder(null);
    setIsSaving(true);
    audioAlert.playClickSound();
    try {
      const payload = stops.map((s, idx) => ({
        assignmentId: s.assignmentId,
        sequence: idx + 1
      }));
      await onReorder(payload);
      audioAlert.playSuccessSound();
      setHasChanges(false);
    } catch(error) {
      setRouteError(error instanceof Error ? error.message : 'Não foi possível salvar a ordem. Tente novamente.');
      audioAlert.playErrorSound();
    } finally {
      setIsSaving(false);
    }
  };

  const handleUndoOrder = () => {
    if (!undoOrder || isSaving || isOptimizing || undoOrder.routeIds !== routeIds) return;
    const restored = undoOrder.ids.map(id => stops.find(stop => assignmentKey(stop) === id));
    if (restored.length !== stops.length || restored.some(stop => !stop)) { setUndoOrder(null); return; }
    requestRevision.current++;
    setStops(undoOrder.hadChanges ? restored as Assignment[] : activeRouteAssignments(assignmentsRef.current));
    setHasChanges(undoOrder.hadChanges); setSuggestion(null); setRouteError(''); setUndoOrder(null);
    audioAlert.playClickSound();
  };

  return (
    <div className="route-screen">
      {/* Cabeçalho da Rota */}
      <div className="route-header">
        <div style={{minWidth:0,flex:1}}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap:'wrap' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Minha Rota de Entregas</h2>
            <TrackingBadge />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Calcule a sequência e confira os km e minutos de cada entrega.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>


          <span
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-strong)',
              color: 'var(--nw-pink)',
              padding: '6px 10px',
              borderRadius: '12px',
              fontSize: '12px',
              fontWeight: 800
            }}
          >
            {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
          </span>
        </div>
      </div>

      <section className="card-surface route-organizer" aria-label="Organizar minha rota">
        <h3 style={{fontSize:16,fontWeight:800}}>Organizar minha rota</h3>
        <p className="route-help">Escolha a prioridade e calcule o melhor caminho pelas ruas.</p>
        <div className="route-mode-options" role="radiogroup" aria-label="Prioridade da rota">
          <button type="button" role="radio" aria-checked={routeMode === 'shortest_distance'} onClick={() => setRouteMode('shortest_distance')} disabled={isOptimizing || isSaving} className={`btn-glove route-mode ${routeMode === 'shortest_distance' ? 'btn-glove-accent' : 'btn-glove-secondary'}`}><Sparkles size={16}/><span>Menor distância</span></button>
          <button type="button" role="radio" aria-checked={routeMode === 'oldest_wait'} onClick={() => setRouteMode('oldest_wait')} disabled={isOptimizing || isSaving} className={`btn-glove route-mode ${routeMode === 'oldest_wait' ? 'btn-glove-accent' : 'btn-glove-secondary'}`}><Clock size={16}/><span>Maior espera</span></button>
        </div>
        <button type="button" className="btn-glove btn-glove-accent route-organize-button" disabled={!stops.length || isOptimizing || isSaving} aria-busy={isOptimizing} onClick={() => void handleOptimizeRoute(routeMode)}>
          <Navigation size={20}/><span>{isOptimizing ? 'Calculando rota...' : staleReason ? 'Recalcular minha rota' : 'Organizar minha rota'}</span>
        </button>
        {!stops.length && <p className="route-help">Confirme a retirada dos pedidos na aba Pedidos para calcular sua rota.</p>}
        {isOptimizing && <p role="status" aria-live="polite" style={{fontSize:13,color:'#ffb3e0'}}>Calculando a melhor rota para suas entregas...</p>}
        {staleReason && <p className="route-location-warning" role="status">Estimativa desatualizada. {staleReason} Calcule novamente para atualizar os minutos.</p>}
        {suggestion && !staleReason && <div className="route-summary" aria-live="polite">
          <p style={{fontSize:12,fontWeight:800}}>{suggestion.mode === 'shortest_distance' ? 'Sugestão por menor distância' : 'Sugestão por maior espera'}</p>
          <p className="route-help">Total de todas as {stops.length} entregas</p>
          <p className="route-total">{(suggestion.totalDistanceMeters / 1000).toLocaleString('pt-BR',{maximumFractionDigits:2})} km <span>·</span> {Math.ceil(suggestion.totalDurationSeconds / 60)} min</p>
          <p className="route-help">Saída usada: <b>{suggestion.origin.source === 'gps' ? 'seu GPS atual' : 'loja'}</b> · {suggestion.calculatedAt ? new Date(suggestion.calculatedAt).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}) : 'agora'} · {suggestion.vehicle === 'motorcycle' || suggestion.source === 'valhalla' ? 'Motocicleta' : 'Direção'}.</p>
          {suggestion.origin.source !== 'gps' && <p className="route-help">Para calcular da sua posição atual, ative o GPS e recalcule.</p>}
          <p className="route-help">Estimativa de direção, sem trânsito ao vivo e sem contar as paradas.</p>
          <details className="route-help"><summary>Como a rota foi calculada</summary><p>{suggestion.rule}</p><p>© OpenStreetMap contributors; {suggestion.source === 'valhalla' ? 'Valhalla' : 'OSRM'}.</p></details>
        </div>}
      </section>
      {routeError && <p className="card-surface" role="alert" style={{fontSize:13,lineHeight:1.6,color:'#fda4af'}}>{routeError}</p>}

      {stops.length === 0 ? (
        <div className="card-surface" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <Navigation size={48} color="var(--nw-purple)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Nenhum pedido na rota</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '300px', margin: '4px auto 0' }}>
            Confirme a retirada dos pedidos preparados na aba "Pedidos" para organizar e iniciar suas entregas.
          </p>
          <button
            onClick={onNavigateToOrders}
            className="btn-glove btn-glove-accent"
            style={{ marginTop: '20px', height: '52px' }}
          >
            <span>Ver Pedidos no Balcão</span>
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <RoutePreview stops={stops} pending={hasChanges} suggestion={staleReason ? null : suggestion} />
          {/* Alerta de Alterações Pendentes */}
          {hasChanges && (
            <div
              style={{
                background: 'rgba(255, 46, 154, 0.15)',
                border: '1px solid var(--nw-pink)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#FFB3E0' }}>
                <AlertCircle size={18} color="var(--nw-pink)" />
                <span>Sequência alterada</span>
              </div>
              <button
                onClick={handleSaveOrder}
                disabled={isSaving || isOptimizing}
                style={{
                  background: 'var(--nw-pink)',
                  color: '#ffffff',
                  border: 'none',
                  padding: '8px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  fontWeight: 800,
                  cursor: 'pointer'
                }}
              >
                {isSaving ? 'Salvando...' : 'Salvar Ordem'}
              </button>
            </div>
          )}

          {/* Lista Ordenada de Paradas com suporte a Drag & Drop e Setas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stops.map((stop, index) => {
              const metric = suggestion?.stops.find(item => item.assignmentId === (stop.assignmentId || stop.id));
              const matchesSuggestion = suggestion?.stops.every((item,i) => item.assignmentId === (stops[i]?.assignmentId || stops[i]?.id));
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;
              const isDragging = draggedIndex === index;

              return (
                <RouteSwipeCard
                  key={assignmentKey(stop)}
                  stop={stop}
                  onDetails={() => onSelectDelivery(stop)}
                  draggable={!isSaving}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`card-surface ${isFirst ? 'card-highlight' : ''}`}
                  style={{
                    viewTransitionName: `delivery-${assignmentKey(stop).replace(/[^a-zA-Z0-9_-]/g, '')}`,
                    borderLeft: isFirst ? '5px solid var(--nw-emerald)' : '5px solid var(--border-strong)',
                    padding: '16px',
                    opacity: isDragging ? 0.4 : 1,
                    cursor: 'grab',
                    transition: 'border 0.2s ease, opacity 0.2s ease'
                  }}
                >
                  {isFirst && <div style={{ marginBottom: 12 }}>
                    <h3 style={{ fontSize: 18, fontWeight: 900, color: 'var(--nw-emerald)' }}>Próxima entrega</h3>
                    <p style={{ fontSize: 12, lineHeight: 1.5, color: 'var(--text-muted)', marginTop: 4 }}>
                      {hasChanges ? 'Prévia da sequência. Toque em Salvar Ordem para confirmar a alteração.' : 'Primeira parada da sua sequência salva. Confira o endereço antes de sair.'}
                    </p>
                  </div>}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', minWidth: 0 }}>
                      <GripVertical size={18} color="var(--text-subtle)" style={{ cursor: 'grab' }} />
                      <span
                        style={{
                          width: '32px',
                          height: '32px',
                          borderRadius: '50%',
                          background: isFirst ? 'var(--nw-emerald)' : 'var(--bg-elevated)',
                          color: isFirst ? '#ffffff' : 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '14px',
                          fontWeight: 900
                        }}
                      >
                        {index + 1}º
                      </span>
                      <div>
                        <span style={{ fontSize: '16px', fontWeight: 900, color: 'var(--text-main)' }}>
                          {stop.orderNumber}
                        </span>
                        {isFirst && (
                          <span
                            style={{
                              marginLeft: '8px',
                              background: 'rgba(16, 185, 129, 0.2)',
                              color: 'var(--nw-emerald)',
                              fontSize: '11px',
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: '8px'
                            }}
                          >
                            {hasChanges ? 'PRÉVIA' : 'PRÓXIMA PARADA'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controles de Subir / Descer Otimizados para Luva */}
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => moveStop(index, 'up')}
                        disabled={isFirst || isSaving}
                        aria-label="Subir posição"
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: isFirst ? 'var(--text-subtle)' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isFirst ? 'not-allowed' : 'pointer',
                          opacity: isFirst ? 0.35 : 1
                        }}
                      >
                        <ArrowUp size={20} />
                      </button>

                      <button
                        onClick={() => moveStop(index, 'down')}
                        disabled={isLast || isSaving}
                        aria-label="Descer posição"
                        style={{
                          width: '42px',
                          height: '42px',
                          borderRadius: '12px',
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: isLast ? 'var(--text-subtle)' : 'var(--text-main)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: isLast ? 'not-allowed' : 'pointer',
                          opacity: isLast ? 0.35 : 1
                        }}
                      >
                        <ArrowDown size={20} />
                      </button>
                    </div>
                  </div>

                  {/* Informações do Destino */}
                  <div style={{ marginTop: '10px' }}>
                    <p style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                      {stop.customerName}
                    </p>
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px', overflowWrap: 'anywhere' }}>
                      📍 {stop.address}, {stop.addressNumber} {stop.addressComplement ? `(${stop.addressComplement})` : ''}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      {stop.neighborhood} • 🍕 {stop.itemsSummary}
                    </p>
                    {stop.instructions && <p style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--text-muted)', marginTop: 6 }}><b>Referência / observações:</b> {stop.instructions}</p>}
                    {isFirst && <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginTop: 6 }}>
                      {typeof stop.deliveryFee === 'number' && Number.isFinite(stop.deliveryFee) && stop.deliveryFee >= 0
                        ? `Frete desta entrega: ${stop.deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}`
                        : 'Frete desta entrega: não informado pela loja'}
                    </p>}
                  </div>

                  {metric && !staleReason && <div className="route-stop-metrics">
                    {metric.locationApproximate && <p className="route-location-warning">Tempo e distância aproximados até a rua. O número do imóvel não foi confirmado no mapa.</p>}
                    {metric.locationApproximate && metric.destinationCoordinates && <a className="route-help" href={`https://www.google.com/maps/search/?api=1&query=${metric.destinationCoordinates.latitude},${metric.destinationCoordinates.longitude}`} target="_blank" rel="noopener noreferrer">Ver o ponto usado no cálculo</a>}
                    {matchesSuggestion && Number.isFinite(metric.distanceMeters) && Number.isFinite(metric.durationSeconds) && <>
                      <p className="route-metric-caption">{index === 0 ? 'Saída até esta entrega' : 'Da entrega anterior até aqui'}</p>
                      <div className="route-metric-grid">
                        <div><span>Distância do trecho</span><strong>{(metric.distanceMeters! / 1000).toLocaleString('pt-BR',{maximumFractionDigits:2})} <small>km</small></strong></div>
                        <div><span>Tempo do trecho</span><strong>{Math.ceil(metric.durationSeconds! / 60)} <small>min</small></strong></div>
                      </div>
                    </>}
                    {matchesSuggestion && Number.isFinite(metric.cumulativeDurationSeconds) && <p className="route-help">Tempo acumulado na rota: <b>{Math.ceil(metric.cumulativeDurationSeconds! / 60)} min</b>, sem contar as paradas.</p>}
                    {Number.isFinite(metric.distanceFromOriginMeters) && Number.isFinite(metric.durationFromOriginSeconds) && <p className="route-help">Direto da origem: {(metric.distanceFromOriginMeters! / 1000).toLocaleString('pt-BR',{maximumFractionDigits:2})} km · {Math.ceil(metric.durationFromOriginSeconds! / 60)} min.</p>}
                    {!matchesSuggestion && <p className="route-help">Ordem alterada. Calcule novamente para atualizar os trechos.</p>}
                  </div>}
                  {/* Botões Rápidos de Navegação e Contato */}
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <button
                      onClick={(e) => handleOpenWaze(e, stop)}
                      style={{
                        flex: 1,
                        background: 'rgba(56, 189, 248, 0.12)',
                        border: '1px solid rgba(56, 189, 248, 0.35)',
                        color: '#38bdf8',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      title="Navegar com Waze"
                    >
                      <Compass size={14} />
                      <span>Waze</span>
                    </button>

                    <button
                      onClick={(e) => handleOpenGoogleMaps(e, stop)}
                      style={{
                        flex: 1,
                        background: 'rgba(52, 211, 153, 0.12)',
                        border: '1px solid rgba(52, 211, 153, 0.35)',
                        color: '#34d399',
                        padding: '8px 10px',
                        borderRadius: '10px',
                        fontSize: '11px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px'
                      }}
                      title="Navegar com Google Maps"
                    >
                      <Map size={14} />
                      <span>Maps</span>
                    </button>

                    {stop.customerPhone && (
                      <button
                        onClick={(e) => handleOpenWhatsApp(e, stop)}
                        style={{
                          flex: 1,
                          background: 'rgba(37, 211, 102, 0.15)',
                          border: '1px solid rgba(37, 211, 102, 0.45)',
                          color: '#25D366',
                          padding: '8px 10px',
                          borderRadius: '10px',
                          fontSize: '11px',
                          fontWeight: 800,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px'
                        }}
                        title="Enviar mensagem WhatsApp avisando que está a caminho"
                      >
                        <MessageCircle size={14} />
                        <span>Zap</span>
                      </button>
                    )}
                  </div>

                  {/* Ação: Abrir Tela de Entrega Ativa */}
                  <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
                    <button
                      onClick={() => onSelectDelivery(stop)}
                      className={`btn-glove ${isFirst ? 'btn-glove-primary' : 'btn-glove-secondary'}`}
                      style={{ height: '48px', fontSize: '14px' }}
                    >
                      <Navigation size={18} />
                      <span>{isFirst ? 'Abrir próxima entrega' : 'Ver Detalhes desta Parada'}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </RouteSwipeCard>
              );
            })}
          </div>
          {undoOrder && <div className="route-undo" role="status" aria-live="polite"><div>Sequência ajustada neste aparelho.<span>Desfazer só restaura a alteração local antes de salvar.</span></div><button type="button" disabled={isSaving || isOptimizing} onClick={handleUndoOrder}>Desfazer</button></div>}
        </>
      )}
    </div>
  );
};
