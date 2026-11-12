import React, { useState, useEffect } from 'react';
import { DriverLoadingSkeleton } from './DriverLoadingSkeleton';
import {
  X,
  Wallet,
  CheckCircle,
  XCircle,
  Calendar,
  MessageCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { DriverAccount, DriverSession, StoreShiftSummary } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { buildShiftSummary } from '../services/shiftSummary';
import { PAYMENT_METHODS, getPaymentMethod, paymentMethodLabel, setPaymentMethod } from '../services/paymentPreference';

interface ScreenProfileLedgerProps {
  account: DriverAccount;
  activeSession: DriverSession | null;
  onClose: () => void;
}

export const ScreenProfileLedger: React.FC<ScreenProfileLedgerProps> = ({
  account,
  activeSession,
  onClose,
}) => {
  // Read data already present before first render to avoid a fake zero-value screen.
  const [ledger, setLedger] = useState<StoreShiftSummary[]>(() => api.getStoresLedger());
  const [ledgerLoading, setLedgerLoading] = useState(() => api.getStoresLedger().length === 0);
  const [ledgerError, setLedgerError] = useState(false);
  const [paymentMethod, setPaymentMethodState] = useState(() => getPaymentMethod());
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let live = true;
    void api.synchronizeAccount()
      .then(() => {
        if (!live) return;
        setLedger(api.getStoresLedger());
        setLedgerError(false);
      })
      .catch(() => {
        if (live) setLedgerError(true);
      })
      .finally(() => {
        if (live) setLedgerLoading(false);
      });
    return ()=>{live=false;};
  }, [attempt]);

  const totalToReceive = ledger.reduce((sum, item) => sum + (item.totalToReceive || 0), 0);
  const totalCompleted = ledger.reduce((sum, item) => sum + (item.completedCount || 0), 0);
  const totalCanceled = ledger.reduce((sum, item) => sum + (item.canceledCount || 0), 0);

  const handleShareWhatsApp = () => {
    audioAlert.playClickSound();
    const text = buildShiftSummary({
      driverName: account.name,
      vehicleModel: account.vehicleModel,
      vehiclePlate: account.vehiclePlate,
      storeName: activeSession?.storeName,
      completed: totalCompleted,
      total: totalToReceive,
      paymentMethod: paymentMethodLabel(paymentMethod),
      // eslint-disable-next-line react/purity -- handler de clique, não render
      at: new Date(),
    });
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          overflowY: 'auto'
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Wallet size={22} color="var(--nw-pink)" />
            <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Meu Extrato</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={onClose}
              aria-label="Fechar extrato"
              style={{
                background: 'var(--bg-elevated)',
                border: 'none',
                color: 'var(--text-muted)',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer'
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Resumo Consolidado de Ganhos */}
        {ledgerLoading ? <DriverLoadingSkeleton variant="history-summary" /> : ledgerError && ledger.length === 0 ? (
          <div className="card-surface" role="alert" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--nw-amber)' }}>
              <AlertCircle size={18} />
              <strong style={{ fontSize: '13px' }}>Não foi possível carregar o extrato</strong>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Verifique sua conexão e tente de novo.
            </span>
            <button
              type="button"
              onClick={() => { audioAlert.playClickSound(); setLedgerLoading(true); setLedgerError(false); setAttempt((value) => value + 1); }}
              className="btn-glove btn-glove-secondary"
              style={{ height: '42px', fontSize: '13px' }}
            >
              <RefreshCw size={16} />
              <span>Tentar de novo</span>
            </button>
          </div>
        ) : <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(139, 47, 232, 0.12))',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '16px',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}
        >
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-muted)' }}>
            Você tem a receber
          </span>
          <p style={{ fontSize: '40px', fontWeight: 900, color: 'var(--nw-emerald)', letterSpacing: '-1.2px', lineHeight: 1.05 }}>
            R$ {totalToReceive.toFixed(2).replace('.', ',')}
          </p>
          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
            Somando {ledger.length} {ledger.length === 1 ? 'loja' : 'lojas'} · {totalCompleted} {totalCompleted === 1 ? 'entrega concluída' : 'entregas concluídas'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', marginTop: '4px' }}>
            <span style={{ color: 'var(--nw-emerald)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle size={14} />
              {totalCompleted} com PIN
            </span>
            {totalCanceled > 0 && (
              <span style={{ color: 'var(--nw-red)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <XCircle size={14} />
                {totalCanceled} canceladas
              </span>
            )}
          </div>

          <div
            style={{
              marginTop: '10px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}
          >
            <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Forma de pagamento
            </span>
            <span style={{ fontSize: '11px', color: paymentMethod ? 'var(--nw-emerald)' : 'var(--text-subtle)' }} role="status">
              {paymentMethod ? `${paymentMethodLabel(paymentMethod)} · salvo neste aparelho` : 'Escolha como prefere receber da loja'}
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {PAYMENT_METHODS.map((option) => {
                const active = paymentMethod === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      const next = active ? null : option.value;
                      setPaymentMethod(next);
                      setPaymentMethodState(next);
                    }}
                    style={{
                      flex: '1 1 auto',
                      minHeight: '38px',
                      padding: '0 12px',
                      borderRadius: '10px',
                      fontSize: '12px',
                      fontWeight: 800,
                      cursor: 'pointer',
                      border: `1px solid ${active ? 'var(--nw-emerald)' : 'var(--border-subtle)'}`,
                      background: active ? 'rgba(16, 185, 129, 0.2)' : 'var(--bg-elevated)',
                      color: active ? 'var(--nw-emerald)' : 'var(--text-muted)'
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <button
            type="button"
            onClick={handleShareWhatsApp}
            style={{
              marginTop: '6px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(16, 185, 129, 0.2)',
              border: '1px solid var(--nw-emerald)',
              color: 'var(--nw-emerald)',
              fontSize: '12px',
              fontWeight: 800,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              width: '100%'
            }}
          >
            <MessageCircle size={16} />
            <span>Enviar Fechamento no WhatsApp da Loja</span>
          </button>
        </div>}

        {/* Lista Individual por Loja */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', marginBottom: '10px' }}>
            Detalhamento por Loja ({ledger.length})
          </h4>
          {ledger.length > 0 && (
            <p style={{ fontSize: '12px', color: 'var(--text-subtle)', marginBottom: '8px' }}>
              Total: <strong style={{ color: 'var(--nw-emerald)' }}>R$ {totalToReceive.toFixed(2).replace('.', ',')}</strong> · {totalCompleted} {totalCompleted === 1 ? 'entrega' : 'entregas'}
            </p>
          )}

          {ledgerLoading ? (
            <DriverLoadingSkeleton variant="history-list" />
          ) : ledgerError && ledger.length === 0 ? (
            <p role="alert" style={{ color: 'var(--nw-amber)', fontSize: 13 }}>
              Histórico indisponível no momento. Tente novamente ao reabrir o extrato.
            </p>
          ) : ledger.length === 0 ? (
            <div
              className="card-surface"
              style={{
                padding: '18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '6px',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}
            >
              <Wallet size={22} color="var(--text-subtle)" aria-hidden="true" />
              <strong style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Nenhum histórico registrado ainda</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>
                Suas entregas concluídas aparecem aqui depois do primeiro plantão.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {ledger.map((store) => (
                <div
                  key={store.storeId}
                  className="card-surface"
                  style={{
                    padding: '14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div>
                      <h5 style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff' }}>
                        {store.storeName}
                      </h5>
                      <span style={{ fontSize: '11px', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Calendar size={12} />
                        Último plantão: {new Date(store.lastShiftDate).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '10px', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 800 }}>
                        Valores registrados
                      </span>
                      <p style={{ fontSize: '16px', fontWeight: 900, color: 'var(--nw-emerald)' }}>
                        R$ {store.totalToReceive.toFixed(2).replace('.', ',')}
                      </p>
                    </div>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      paddingTop: '8px',
                      borderTop: '1px solid var(--border-subtle)',
                      fontSize: '11px'
                    }}
                  >
                    <span style={{ color: 'var(--nw-emerald)', fontWeight: 700 }}>
                      ✔ {store.completedCount} entregas concluídas
                    </span>
                    {store.canceledCount > 0 && (
                      <span style={{ color: 'var(--nw-red)', fontWeight: 700 }}>
                        ✖ {store.canceledCount} desistências
                      </span>
                    )}
                  </div>
                  <details style={{borderTop:'1px solid var(--border-subtle)',paddingTop:10,fontSize:12}}>
                    <summary style={{cursor:'pointer',fontWeight:800}}>Ver entregas e valores ({store.deliveries?.length || 0})</summary>
                    <p style={{color:'var(--text-muted)',marginTop:8}}>Histórico preservado mesmo sem vínculo ativo. Valores registrados por entrega; pagamento não é confirmado neste extrato.</p>
                    {(store.deliveries || []).map(item=><div key={item.assignmentId} style={{padding:'10px 0',borderBottom:'1px solid var(--border-subtle)',display:'flex',justifyContent:'space-between',gap:8}}>
                      <span>Pedido #{item.orderNumber}<br/><small>{item.deliveredAt ? new Date(item.deliveredAt).toLocaleString('pt-BR') : 'Data não registrada'}</small></span>
                      <strong>{item.amount == null ? 'Valor não informado' : item.amount.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</strong>
                    </div>)}
                    {!!store.uninformedCount && <p style={{color:'#fde68a',marginTop:8}}>{store.uninformedCount} entrega(s) sem valor informado.</p>}
                  </details>
                </div>
              ))}
            </div>
          )}
        </div>



      </div>
    </div>
  );
};

export default ScreenProfileLedger;
