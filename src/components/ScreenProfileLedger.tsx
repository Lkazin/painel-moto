import React, { useState, useEffect } from 'react';
import { DriverLoadingSkeleton } from './DriverLoadingSkeleton';
import {
  X,
  User,
  Bike,
  CreditCard,
  Phone,
  Wallet,
  Store,
  CheckCircle,
  XCircle,
  Calendar,
  LogOut,
  Power,
  TrendingUp,
  AlertCircle,
  MessageCircle,
  Copy,
  Check,
  Settings
} from 'lucide-react';
import { DriverAccount, DriverSession, StoreShiftSummary } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';

interface ScreenProfileLedgerProps {
  account: DriverAccount;
  activeSession: DriverSession | null;
  onClose: () => void;
  onCloseShift: () => void | Promise<void>;
  onLogoutAccount: () => void;
  onShowToast?: (text: string, type: 'success' | 'error' | 'info') => void;
  onOpenSettings: () => void;
}

export const ScreenProfileLedger: React.FC<ScreenProfileLedgerProps> = ({
  account,
  activeSession,
  onClose,
  onCloseShift,
  onLogoutAccount,
  onShowToast,
  onOpenSettings,
}) => {
  // Read data already present before first render to avoid a fake zero-value screen.
  const [ledger, setLedger] = useState<StoreShiftSummary[]>(() => api.getStoresLedger());
  const [ledgerLoading, setLedgerLoading] = useState(() => api.getStoresLedger().length === 0);
  const [ledgerError, setLedgerError] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  const [copiedSummary, setCopiedSummary] = useState(false);
  const [showChangelog, setShowChangelog] = useState(false);

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
  }, []);

  const totalToReceive = ledger.reduce((sum, item) => sum + (item.totalToReceive || 0), 0);
  const totalCompleted = ledger.reduce((sum, item) => sum + (item.completedCount || 0), 0);
  const totalCanceled = ledger.reduce((sum, item) => sum + (item.canceledCount || 0), 0);

  const handleEndShift = async () => {
    if (!activeSession) return;
    setClosingShift(true);
    audioAlert.playClickSound();

    try {
      await onCloseShift();
      audioAlert.playSuccessSound();
      setLedger(api.getStoresLedger());
    } catch (e) {
      audioAlert.playErrorSound();
    } finally {
      setClosingShift(false);
    }
  };

  const formatSummaryText = () => {
    const storeName = activeSession?.storeName || 'Pizzaria';
    const nowStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return `📋 *FECHAMENTO DE PLANTÃO - ${account.name.toUpperCase()}*\n` +
      `🏍️ Veículo: ${account.vehicleModel || 'Moto'} (Placa ${account.vehiclePlate})\n` +
      `🏪 Estabelecimento: ${storeName}\n` +
      `📅 Data/Hora: ${nowStr}\n\n` +
      `✅ *Entregas concluídas com PIN:* ${totalCompleted}\n` +
      `💵 *Total de Valores das entregas:* R$ ${totalToReceive.toFixed(2).replace('.', ',')}\n\n` +
      `_Enviado pelo App do Entregador_`;
  };

  const handleCopySummary = async () => {
    audioAlert.playClickSound();
    try {
      await navigator.clipboard.writeText(formatSummaryText());
      setCopiedSummary(true);
      if (onShowToast) onShowToast('Extrato copiado para a área de transferência!', 'success');
      setTimeout(() => setCopiedSummary(false), 3000);
    } catch {
      if (onShowToast) onShowToast('Erro ao copiar extrato.', 'error');
    }
  };

  const handleShareWhatsApp = () => {
    audioAlert.playClickSound();
    const storeName = activeSession?.storeName || 'Pizzaria';
    const nowStr = new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    const text = `📋 *FECHAMENTO DE PLANTÃO - ${account.name.toUpperCase()}*\n` +
      `🏍️ Veículo: ${account.vehicleModel || 'Moto'} (Placa ${account.vehiclePlate})\n` +
      `🏪 Estabelecimento: ${storeName}\n` +
      `📅 Data/Hora: ${nowStr}\n\n` +
      `✅ *Entregas concluídas com PIN:* ${totalCompleted}\n` +
      `💵 *Total de Valores das entregas:* R$ ${totalToReceive.toFixed(2).replace('.', ',')}\n\n` +
      `_Enviado pelo App do Entregador_`;

    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
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
          <button
            onClick={onClose}
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

        {/* Resumo Consolidado de Ganhos */}
        {ledgerLoading ? <DriverLoadingSkeleton variant="history-summary" /> : ledgerError && ledger.length === 0 ? (
          <div className="card-surface" role="alert" style={{ padding: 18 }}>
            Não foi possível carregar o extrato. Verifique sua conexão e reabra a tela para tentar novamente.
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
          <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            Extrato Acumulado Geral (Todas as Lojas)
          </span>
          <p style={{ fontSize: '26px', fontWeight: 900, color: 'var(--nw-emerald)' }}>
            R$ {totalToReceive.toFixed(2).replace('.', ',')}
          </p>
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
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: '13px'
              }}
            >
              Nenhum histórico registrado ainda.
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

        <button
          type="button"
          onClick={() => { audioAlert.playClickSound(); onOpenSettings(); }}
          className="btn-glove btn-glove-secondary"
          style={{ height: '48px', fontSize: '13px' }}
        >
          <Settings size={16} color="var(--nw-pink)" />
          <span>Abrir Configurações</span>
        </button>

      </div>
    </div>
  );
};

export default ScreenProfileLedger;
