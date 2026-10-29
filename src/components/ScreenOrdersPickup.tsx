import React, { useState } from 'react';
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

interface ScreenOrdersPickupProps {
  assignments: Assignment[];
  onConfirmPickup: (assignmentIds: string[]) => Promise<void>;
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

  const waitingPickup = assignments.filter((a) => a.status === 'waiting_pickup');
  const pickedUp = assignments.filter(
    (a) => a.status === 'picked_up' || a.status === 'in_transit'
  );

  const toggleSelect = (id: string) => {
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
      setSelectedIds(waitingPickup.map((a) => a.assignmentId));
    }
  };

  const handleConfirm = async () => {
    if (selectedIds.length === 0 || isSubmitting) return;
    setIsSubmitting(true);
    audioAlert.playClickSound();
    try {
      await onConfirmPickup(selectedIds);
      audioAlert.playSuccessSound();
      setSelectedIds([]);
      setActiveTab('picked');
    } catch (err) {
      audioAlert.playErrorSound();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ padding: '16px 16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: '#c084fc',
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
                  <span>Selecionar Todos</span>
                </button>
              </div>

              {/* Lista de Pedidos Aguardando Retirada */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {waitingPickup.map((item) => {
                  const isSelected = selectedIds.includes(item.assignmentId);
                  return (
                    <div
                      key={item.assignmentId}
                      onClick={() => toggleSelect(item.assignmentId)}
                      className={`card-surface ${isSelected ? 'card-highlight' : ''}`}
                      style={{
                        cursor: 'pointer',
                        borderColor: isSelected ? 'var(--nw-pink)' : 'var(--border-subtle)',
                        boxShadow: isSelected ? '0 0 16px var(--nw-pink-glow)' : 'none'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ color: isSelected ? 'var(--nw-pink)' : 'var(--text-muted)' }}>
                            {isSelected ? (
                              <CheckSquare size={24} color="var(--nw-pink)" />
                            ) : (
                              <Square size={24} />
                            )}
                          </div>
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
                  onClick={handleConfirm}
                  disabled={selectedIds.length === 0 || isSubmitting}
                  className="btn-glove btn-glove-primary"
                  style={{ height: '62px', fontSize: '17px' }}
                >
                  <PackageCheck size={24} strokeWidth={2.4} />
                  <span>
                    {isSubmitting
                      ? 'Confirmando com a loja...'
                      : selectedIds.length > 0
                      ? `Confirmar Retirada (${selectedIds.length} selecionados)`
                      : 'Selecione os pedidos para retirar'}
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
                <div key={item.assignmentId} className="card-surface">
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
    </div>
  );
};
