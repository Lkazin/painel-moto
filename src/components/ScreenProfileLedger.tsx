import React, { useState, useEffect } from 'react';
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
  AlertCircle
} from 'lucide-react';
import { DriverAccount, DriverSession, StoreShiftSummary } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';

interface ScreenProfileLedgerProps {
  account: DriverAccount;
  activeSession: DriverSession | null;
  onClose: () => void;
  onCloseShift: () => void;
  onLogoutAccount: () => void;
}

export const ScreenProfileLedger: React.FC<ScreenProfileLedgerProps> = ({
  account,
  activeSession,
  onClose,
  onCloseShift,
  onLogoutAccount
}) => {
  const [ledger, setLedger] = useState<StoreShiftSummary[]>([]);
  const [closingShift, setClosingShift] = useState(false);

  useEffect(() => {
    setLedger(api.getStoresLedger());
  }, []);

  const totalToReceive = ledger.reduce((sum, item) => sum + (item.totalToReceive || 0), 0);
  const totalCompleted = ledger.reduce((sum, item) => sum + (item.completedCount || 0), 0);
  const totalCanceled = ledger.reduce((sum, item) => sum + (item.canceledCount || 0), 0);

  const handleEndShift = async () => {
    if (!activeSession) return;
    setClosingShift(true);
    audioAlert.playClickSound();

    try {
      await api.closeStoreShift();
      audioAlert.playSuccessSound();
      setLedger(api.getStoresLedger());
      onCloseShift();
    } catch (e) {
      audioAlert.playErrorSound();
    } finally {
      setClosingShift(false);
    }
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
            <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Meu Perfil & Extrato</h3>
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

        {/* Card do Perfil do Entregador */}
        <div className="card-surface card-highlight" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '50px',
                height: '50px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '22px'
              }}
            >
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>
                {account.name}
              </h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Phone size={12} />
                {account.phone}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px',
              marginTop: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-subtle)',
              fontSize: '12px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <CreditCard size={14} color="var(--nw-pink)" />
              <span>Placa: <strong style={{ color: '#ffffff' }}>{account.vehiclePlate}</strong></span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)' }}>
              <Bike size={14} color="var(--nw-purple)" />
              <span>{account.vehicleModel || 'Moto'}</span>
            </div>
          </div>
        </div>

        {/* Se houver Plantão Ativo */}
        {activeSession && (
          <div
            style={{
              background: 'rgba(236, 72, 153, 0.12)',
              border: '1.5px solid var(--nw-pink)',
              borderRadius: '16px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: 'var(--nw-pink)', textTransform: 'uppercase' }}>
                Plantão em Andamento
              </span>
              <span style={{ fontSize: '10px', background: 'var(--nw-emerald)', color: '#000', fontWeight: 900, padding: '2px 8px', borderRadius: '8px' }}>
                CONECTADO
              </span>
            </div>
            <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
              {activeSession.storeName}
            </h4>

            <button
              onClick={handleEndShift}
              disabled={closingShift}
              className="btn-glove btn-glove-danger"
              style={{ height: '48px', fontSize: '13px' }}
            >
              <Power size={18} />
              <span>{closingShift ? 'Encerrando...' : 'Encerrar Plantão nesta Loja'}</span>
            </button>
          </div>
        )}

        {/* Resumo Consolidado de Ganhos */}
        <div
          style={{
            background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(139, 92, 246, 0.12))',
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
        </div>

        {/* Lista Individual por Loja */}
        <div>
          <h4 style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', marginBottom: '10px' }}>
            Detalhamento por Loja ({ledger.length})
          </h4>

          {ledger.length === 0 ? (
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
                        A Receber
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
                      ✔ {store.completedCount} entregas com PIN
                    </span>
                    {store.canceledCount > 0 && (
                      <span style={{ color: 'var(--nw-red)', fontWeight: 700 }}>
                        ✖ {store.canceledCount} desistências
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Botão de Logout da Conta */}
        <button
          onClick={() => {
            audioAlert.playClickSound();
            onLogoutAccount();
          }}
          className="btn-glove"
          style={{
            height: '50px',
            fontSize: '13px',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--nw-red)',
            marginTop: '8px'
          }}
        >
          <LogOut size={16} />
          <span>Sair da Minha Conta de Entregador</span>
        </button>
      </div>
    </div>
  );
};

export default ScreenProfileLedger;
