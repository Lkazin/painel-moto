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
  const [isSaving, setIsSaving] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [suggestion, setSuggestion] = useState<OptimizedRouteResult | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const assignmentsRef = useRef(assignments);
  const hasChangesRef = useRef(hasChanges);
  const requestRevision = useRef(0);
  const routeIds = activeRouteAssignments(assignments).map(assignmentKey).sort().join('|');
  const previousRouteIds = useRef(routeIds);
  assignmentsRef.current = assignments;
  hasChangesRef.current = hasChanges;

  useEffect(() => {
    setStops(previous => reconcileRouteStops(previous,assignments,hasChangesRef.current));
    if (previousRouteIds.current !== routeIds) {setSuggestion(null);previousRouteIds.current = routeIds;}
  },[assignments,routeIds]);
  useEffect(() => () => {requestRevision.current++;},[]);

  const handleOptimizeRoute = async (mode: RouteOptimizationMode) => {
    if (!stops.length || isOptimizing || isSaving) return;
    const revision = ++requestRevision.current;
    setIsOptimizing(true); setRouteError(''); audioAlert.playClickSound();
    try {
      const tracking = trackingService.getState(), location = tracking.lastLocation;
      const recent = tracking.isActive && location && Number.isFinite(location.timestamp) && Date.now() - Number(location.timestamp) <= 120000 && Date.now() >= Number(location.timestamp);
      const origin = recent && Number.isFinite(location.latitude) && Math.abs(location.latitude) <= 90 && Number.isFinite(location.longitude) && Math.abs(location.longitude) <= 180 ? {latitude:location.latitude,longitude:location.longitude} : undefined;
      const result = await api.getOptimizeRoute(mode,origin);
      if (revision !== requestRevision.current) return;
      const optimized = mapOptimizedStops(result,assignmentsRef.current);
      setStops(optimized); setHasChanges(true); setSuggestion(result); audioAlert.playSuccessSound();
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
    requestRevision.current++; setIsOptimizing(false); setSuggestion(null); setRouteError('');
    audioAlert.playClickSound();
    const newStops = [...stops];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;

    if (targetIndex < 0 || targetIndex >= newStops.length) return;

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
    if (draggedIndex === null || draggedIndex === targetIndex) return;

    requestRevision.current++; setIsOptimizing(false); setSuggestion(null); setRouteError('');
    const newStops = [...stops];
    const [removed] = newStops.splice(draggedIndex, 1);
    newStops.splice(targetIndex, 0, removed);

    setStops(newStops);
    setHasChanges(true);
    setDraggedIndex(null);
    audioAlert.playClickSound();
  };

  const handleSaveOrder = async () => {
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

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Cabeçalho da Rota */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Minha Rota de Entregas</h2>
            <TrackingBadge />
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Organize por arrastar ou setas. O lojista apenas visualiza.
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

      {stops.length > 0 && <section className="card-surface" aria-label="Calcular sequência das entregas" style={{display:'flex',flexDirection:'column',gap:12}}>
        <h3 style={{fontSize:15,fontWeight:800}}>Como você quer organizar as entregas?</h3>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
          <button type="button" onClick={() => void handleOptimizeRoute('shortest_distance')} disabled={isOptimizing || isSaving} className="btn-glove btn-glove-accent" style={{fontSize:12,padding:10,height:'auto',minHeight:52}}><Sparkles size={16}/><span>Menor distância</span></button>
          <button type="button" onClick={() => void handleOptimizeRoute('oldest_wait')} disabled={isOptimizing || isSaving} className="btn-glove btn-glove-secondary" style={{fontSize:12,padding:10,height:'auto',minHeight:52}}><Clock size={16}/><span>Maior espera primeiro</span></button>
        </div>
        {isOptimizing && <p role="status" aria-live="polite" style={{fontSize:13,color:'#ffb3e0'}}>Calculando a melhor rota para suas entregas...</p>}
        {suggestion && <div style={{fontSize:12,lineHeight:1.7,color:'var(--text-muted)'}} aria-live="polite">
          <p style={{color:'#fff',fontWeight:700}}>{suggestion.mode === 'shortest_distance' ? 'Sugestão por menor distância' : 'Sugestão por maior espera'}</p>
          <p>{suggestion.rule}</p>
          <p>{`${(suggestion.totalDistanceMeters / 1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} km de percurso • ${Math.ceil(suggestion.totalDurationSeconds / 60)} min de deslocamento estimado pelo OSRM.`}</p>
          <p>O tempo é apenas de direção, sem trânsito ao vivo nem tempo de atendimento. Não é uma promessa de chegada. Salve a ordem para usar esta sequência.</p>
          <p>© OpenStreetMap contributors; OSRM.</p>
        </div>}
      </section>}
      {routeError && <p className="card-surface" role="alert" style={{fontSize:13,lineHeight:1.6,color:'#fda4af'}}>{routeError}</p>}

      {stops.length === 0 ? (
        <div className="card-surface" style={{ textAlign: 'center', padding: '36px 20px' }}>
          <Navigation size={48} color="var(--nw-purple)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Nenhum pedido na rota</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', maxWidth: '300px', margin: '4px auto 0' }}>
            Retire as pizzas preparadas na aba "Pedidos" para organizar e iniciar suas entregas.
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
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;
              const isDragging = draggedIndex === index;

              return (
                <div
                  key={stop.assignmentId}
                  draggable={!isSaving}
                  onDragStart={(e) => handleDragStart(e, index)}
                  onDragOver={handleDragOver}
                  onDrop={(e) => handleDrop(e, index)}
                  className={`card-surface ${isFirst ? 'card-highlight' : ''}`}
                  style={{
                    borderLeft: isFirst ? '5px solid var(--nw-emerald)' : '5px solid var(--border-strong)',
                    padding: '16px',
                    opacity: isDragging ? 0.4 : 1,
                    cursor: 'grab',
                    transition: 'border 0.2s ease, opacity 0.2s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        <span style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
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
                            PARADA ATUAL
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
                          color: isFirst ? 'var(--text-subtle)' : '#ffffff',
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
                          color: isLast ? 'var(--text-subtle)' : '#ffffff',
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
                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      📍 {stop.address}, {stop.addressNumber} {stop.addressComplement ? `(${stop.addressComplement})` : ''}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      {stop.neighborhood} • 🍕 {stop.itemsSummary}
                    </p>
                  </div>

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
                      <span>{isFirst ? 'Iniciar Entrega Agora' : 'Ver Detalhes desta Parada'}</span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
};
