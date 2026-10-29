import React, { useState } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { Assignment } from '../types';
import { audioAlert } from '../utils/audioAlert';

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
  // Apenas pedidos retirados entram na rota
  const activeAssignments = assignments
    .filter((a) => a.status === 'picked_up' || a.status === 'in_transit')
    .sort((a, b) => a.sequence - b.sequence);

  const [stops, setStops] = useState<Assignment[]>(activeAssignments);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Reordenação por setas Subir/Descer
  const moveStop = (index: number, direction: 'up' | 'down') => {
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
    } catch {
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
          <h2 style={{ fontSize: '20px', fontWeight: 900 }}>Minha Rota de Entregas</h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Defina a ordem das entregas. O lojista apenas visualiza.
          </p>
        </div>
        <span
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-strong)',
            color: 'var(--nw-pink)',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 800
          }}
        >
          {stops.length} {stops.length === 1 ? 'parada' : 'paradas'}
        </span>
      </div>

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
                background: 'rgba(236, 72, 153, 0.15)',
                border: '1px solid var(--nw-pink)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', fontWeight: 700, color: '#fbcfe8' }}>
                <AlertCircle size={18} color="var(--nw-pink)" />
                <span>Sequência alterada</span>
              </div>
              <button
                onClick={handleSaveOrder}
                disabled={isSaving}
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

          {/* Lista Ordenada de Paradas */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stops.map((stop, index) => {
              const isFirst = index === 0;
              const isLast = index === stops.length - 1;

              return (
                <div
                  key={stop.assignmentId}
                  className={`card-surface ${isFirst ? 'card-highlight' : ''}`}
                  style={{
                    borderLeft: isFirst ? '5px solid var(--nw-emerald)' : '5px solid var(--border-strong)',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
                        disabled={isFirst}
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
                        disabled={isLast}
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

                  {/* Ação: Abrir Tela de Entrega Ativa */}
                  <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)' }}>
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
