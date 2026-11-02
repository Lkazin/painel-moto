import React, { useState, useEffect, useRef } from 'react';
import {
  PackageCheck,
  Package,
  CheckSquare,
  Square,
  AlertTriangle,
  ArrowRight,
  Clock,
  MapPin,
  ChevronRight,
  Layers,
  Store
} from 'lucide-react';
import { Assignment } from '../types';
import { audioAlert } from '../utils/audioAlert';
import { assignmentKey, keepPickupSelection, waitingPickupAssignments, activeRouteAssignments } from '../services/pickupRouteState';

interface ScreenOrdersPickupProps {
  assignments: Assignment[];
  onConfirmPickup: (assignmentIds: string[], pickupScopeIds: string[]) => Promise<void>;
  onRequestWithdraw: (assignment: Assignment) => void;
  onNavigateToRoute: () => void;
}

export const ScreenOrdersPickup: React.FC<ScreenOrdersPickupProps> = ({
  assignments,
  onConfirmPickup,
  onRequestWithdraw,
  onNavigateToRoute
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'waiting' | 'picked'>('waiting');

  const [confirmation, setConfirmation] = useState<{ selected: string[]; scope: string[] } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const confirmDialog = useRef<HTMLDialogElement>(null);
  const waitingPickup = waitingPickupAssignments(assignments);
  const pickedUp = activeRouteAssignments(assignments);
  const visibleSelectedIds = keepPickupSelection(selectedIds, assignments);

  useEffect(() => { setSelectedIds(previous => keepPickupSelection(previous, assignments)); }, [assignments]);
  useEffect(() => {
    if (confirmation) confirmDialog.current?.showModal();
    return () => confirmDialog.current?.close();
  }, [confirmation]);

  const toggleSelect = (id: string) => {
    if (isSubmitting) return;
    setErrorMessage('');
    audioAlert.playClickSound();
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    audioAlert.playClickSound();
    if (selectedIds.length === waitingPickup.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(waitingPickup.map((a) => a.assignmentId || a.id || ''));
    }
  };

  const handleConfirm = () => {
    if (!visibleSelectedIds.length || isSubmitting) return;
    setErrorMessage('');
    setConfirmation({ selected: [...visibleSelectedIds], scope: waitingPickup.map(assignmentKey) });
  };

  const submitPickup = async () => {
    if (!confirmation || isSubmitting) return;
    const currentIds = new Set(waitingPickup.map(assignmentKey));
    if (confirmation.scope.some(id => !currentIds.has(id))) {
      setConfirmation(null);
      setErrorMessage('O balcão mudou. Confira os pedidos e confirme novamente.');
      return;
    }
    setIsSubmitting(true);
    audioAlert.playClickSound();
    try {
      await onConfirmPickup(confirmation.selected, confirmation.scope);
      audioAlert.playSuccessSound();
      setSelectedIds([]);
      setConfirmation(null);
      setActiveTab('picked');
      onNavigateToRoute();
    } catch (err: any) {
      setConfirmation(null);
      audioAlert.playErrorSound();
      setErrorMessage(err?.message || 'Não foi possível confirmar a retirada na loja. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {errorMessage && <p className="card-surface" role="alert" style={{ color: '#fda4af' }}>{errorMessage}</p>}
      {/* Abas Superiores */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          background: 'var(--bg-card)',
          padding: '4px',
          borderRadius: '16px'
        }}
      >
        <button
          onClick={() => {
            audioAlert.playClickSound();
            setActiveTab('waiting');
          }}
          style={{
            background: activeTab === 'waiting' ? 'var(--nw-pink)' : 'transparent',
            color: activeTab === 'waiting' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            padding: '12px 8px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <Package size={16} />
          <span>No Balcão ({waitingPickup.length})</span>
        </button>

        <button
          onClick={() => {
            audioAlert.playClickSound();
            setActiveTab('picked');
          }}
          style={{
            background: activeTab === 'picked' ? 'var(--nw-purple)' : 'transparent',
            color: activeTab === 'picked' ? '#ffffff' : 'var(--text-muted)',
            border: 'none',
            padding: '12px 8px',
            borderRadius: '12px',
            fontWeight: 800,
            fontSize: '13px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          <PackageCheck size={16} />
          <span>Retirados ({pickedUp.length})</span>
        </button>
      </div>

      {/* Conteúdo da Aba 1: No Balcão (Aguardando Retirada) */}
      {activeTab === 'waiting' && (
        <>
          {waitingPickup.length === 0 ? (
            <div className="card-surface" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <PackageCheck size={48} color="var(--nw-emerald)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '18px', fontWeight: 800 }}>Nenhum pedido no balcão</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Todos os pedidos aceitos já foram retirados ou você não possui entregas pendentes.
              </p>
              {pickedUp.length > 0 && (
                <button
                  onClick={onNavigateToRoute}
                  className="btn-glove btn-glove-accent"
                  style={{ marginTop: '20px', height: '52px' }}
                >
                  <span>Ir para Minha Rota ({pickedUp.length} entregas)</span>
                  <ArrowRight size={18} />
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Barra de Selecionar Todos */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)' }}>
                  {waitingPickup.length} {waitingPickup.length === 1 ? 'pedido pronto' : 'pedidos prontos'} na forneria
                </span>
                <button
                  onClick={selectAll}
                  disabled={isSubmitting}
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: '#FFB3E0',
                    padding: '6px 12px',
                    borderRadius: '10px',
                    fontSize: '12px',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {selectedIds.length === waitingPickup.length ? (
                    <CheckSquare size={16} color="var(--nw-pink)" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span>{visibleSelectedIds.length === waitingPickup.length ? 'Desmarcar todos' : 'Selecionar todos'}</span>
                </button>
              </div>

              {/* Lista de Pedidos Aguardando Retirada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitingPickup.map((item) => {
                  const itemId = item.assignmentId || item.id || '';
                  const isSelected = visibleSelectedIds.includes(itemId);
                  return (
                    <div
                      key={itemId}
                      onClick={() => toggleSelect(itemId)}
                      className={`card-surface ${isSelected ? 'card-highlight' : ''}`}
                      style={{
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--nw-pink)' : 'var(--border-subtle)',
                        boxShadow: isSelected ? '0 0 16px var(--nw-pink-glow)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(itemId)} onClick={event => event.stopPropagation()} disabled={isSubmitting} aria-label={`Retirar pedido ${item.orderNumber}`} style={{ width: 24, height: 24, accentColor: 'var(--nw-pink)', flexShrink: 0 }} />
                          <div>
                            <span style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>
                              {item.orderNumber}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-subtle)', marginLeft: '8px' }}>
                              {item.storeName}
                            </span>
                          </div>
                        </div>

                        {item.deliveryFee !== null && (
                          <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--nw-emerald)' }}>
                            R$ {item.deliveryFee.toFixed(2).replace('.', ',')}
                          </span>
                        )}
                      </div>

                      {/* Itens e Endereço */}
                      <div style={{ background: 'var(--bg-app)', padding: '10px 12px', borderRadius: '12px', fontSize: '13px' }}>
                        <p style={{ fontWeight: 700, color: '#ffffff', marginBottom: '4px' }}>
                          🍕 {item.itemsSummary}
                        </p>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                          📍 {item.address}, {item.addressNumber} ({item.neighborhood})
                        </p>
                      </div>

                      {/* Botão de Desistência / Ocorrência */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRequestWithdraw(item);
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--text-subtle)',
                            fontSize: '11px',
                            fontWeight: 700,
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Solicitar desistência à loja
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Botão de Confirmação de Retirada no Balcão */}
              <div style={{ position: 'sticky', bottom: 'calc(var(--nav-height) + 10px)', zIndex: 30 }}>
                <button
                  type="button"
                  onClick={handleConfirm}
                  disabled={visibleSelectedIds.length === 0 || isSubmitting}
                  className="btn-glove btn-glove-primary"
                  style={{ height: '62px', fontSize: '17px' }}
                >
                  <PackageCheck size={24} strokeWidth={2.4} />
                  <span>
                    {isSubmitting
                      ? 'Confirmando com a loja...'
                      : visibleSelectedIds.length > 0
                      ? `Retirar ${visibleSelectedIds.length} pedido(s) selecionado(s)`
                      : 'Selecione os pedidos que vai retirar'}
                  </span>
                </button>
              </div>
            </>
          )}
        </>
      )}

      {/* Conteúdo da Aba 2: Já Retirados (Prontos para Rota) */}
      {activeTab === 'picked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {pickedUp.length === 0 ? (
            <div className="card-surface" style={{ textAlign: 'center', padding: '36px 20px' }}>
              <Package size={44} color="var(--text-subtle)" style={{ margin: '0 auto 10px' }} />
              <h3 style={{ fontSize: '16px', fontWeight: 800 }}>Nenhum pedido retirado ainda</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Vá até a aba "No Balcão" para confirmar os pedidos que estão no seu baú.
              </p>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--text-muted)' }}>
                  {pickedUp.length} entregas no baú da moto
                </span>
                <button
                  onClick={onNavigateToRoute}
                  className="btn-glove btn-glove-accent"
                  style={{ height: '44px', padding: '8px 16px', fontSize: '13px', width: 'auto' }}
                >
                  <span>Organizar Rota</span>
                  <ArrowRight size={16} />
                </button>
              </div>

              {pickedUp.map((item, idx) => (
                <div key={item.assignmentId || item.id} className="card-surface">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span
                        style={{
                          background: 'var(--nw-purple)',
                          color: '#fff',
                          width: '26px',
                          height: '26px',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: 900,
                          fontSize: '12px'
                        }}
                      >
                        {idx + 1}
                      </span>
                      <strong style={{ fontSize: '16px' }}>{item.orderNumber}</strong>
                    </div>
                    <span
                      style={{
                        background: 'rgba(16, 185, 129, 0.15)',
                        border: '1px solid var(--nw-emerald)',
                        color: 'var(--nw-emerald)',
                        fontSize: '11px',
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: '8px'
                      }}
                    >
                      {item.isPendingSync ? 'Retirado (Pendente Sinc)' : 'Retirada Confirmada'}
                    </span>
                  </div>

                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#ffffff' }}>
                    {item.customerName}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    📍 {item.address}, {item.addressNumber} • {item.neighborhood}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      )}
      {confirmation && <dialog ref={confirmDialog} aria-labelledby="pickup-confirm-title" aria-describedby="pickup-confirm-details" onCancel={event => { if (isSubmitting) event.preventDefault(); else setConfirmation(null); }} style={{ margin: 'auto', width: 'min(440px, calc(100vw - 32px))', padding: 22, borderRadius: 18, border: '1px solid var(--border-strong)', background: 'var(--bg-card)', color: '#fff' }}>
        <h2 id="pickup-confirm-title" style={{ fontSize: 20, marginBottom: 12 }}>Confirmar retirada</h2>
        <p id="pickup-confirm-details" style={{ fontSize: 14, lineHeight: 1.6 }}><strong>{confirmation.selected.length} pedido(s) serão retirados.</strong> {confirmation.scope.length - confirmation.selected.length > 0 ? `${confirmation.scope.length - confirmation.selected.length} pedido(s) não selecionado(s) serão devolvidos ao despacho da loja e não entrarão na sua rota.` : 'Todos os pedidos desta confirmação entrarão na sua rota.'}</p>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 10 }}>Confira se apenas os pedidos que estão com você foram marcados.</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 18 }}>
          <button type="button" className="btn-glove btn-glove-primary" disabled={isSubmitting} onClick={() => void submitPickup()}>{isSubmitting ? 'Confirmando com a loja...' : 'Confirmar estes pedidos'}</button>
          <button type="button" className="btn-glove btn-glove-secondary" disabled={isSubmitting} onClick={() => setConfirmation(null)}>Voltar e conferir</button>
        </div>
      </dialog>}
    </div>
  );
};
