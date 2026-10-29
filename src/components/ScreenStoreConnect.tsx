import React, { useState, useEffect } from 'react';
import {
  Store,
  KeyRound,
  ArrowRight,
  Bike,
  LogOut,
  Wallet,
  CheckCircle,
  XCircle,
  Calendar,
  AlertCircle,
  Sparkles,
  ChevronRight
} from 'lucide-react';
import { DriverAccount, DriverSession, StoreShiftSummary } from '../types';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';

interface ScreenStoreConnectProps {
  account: DriverAccount;
  onShiftStarted: (session: DriverSession) => void;
  onLogoutAccount: () => void;
  onOpenLedgerModal: () => void;
}

export const ScreenStoreConnect: React.FC<ScreenStoreConnectProps> = ({
  account,
  onShiftStarted,
  onLogoutAccount,
  onOpenLedgerModal
}) => {
  const [storeCode, setStoreCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [ledger, setLedger] = useState<StoreShiftSummary[]>([]);

  useEffect(() => {
    setLedger(api.getStoresLedger());
  }, []);

  const totalToReceiveAll = ledger.reduce((acc, curr) => acc + (curr.totalToReceive || 0), 0);
  const totalDeliveriesAll = ledger.reduce((acc, curr) => acc + (curr.completedCount || 0), 0);

  const handleFormatCode = (val: string) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!clean.startsWith('NW-') && clean.length > 0) {
      if (clean.startsWith('NW')) {
        clean = 'NW-' + clean.substring(2);
      } else {
        clean = 'NW-' + clean.replace(/-/g, '');
      }
    }
    setStoreCode(clean);
    setErrorMessage(null);
  };

  const handleConnectStore = async (codeToUse?: string) => {
    const code = (codeToUse || storeCode).trim().toUpperCase();
    if (!code || code.length < 5) {
      setErrorMessage('Digite o código fornecido pela loja (ex: NW-XXXXXX).');
      audioAlert.playErrorSound();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    audioAlert.playClickSound();

    try {
      const session = await api.activateStoreShift(code);
      audioAlert.playSuccessSound();
      onShiftStarted(session);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Código da loja inválido ou não autorizado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        maxWidth: '520px',
        margin: '0 auto',
        minHeight: '94vh'
      }}
    >
      {/* Top Bar com Perfil do Motoboy */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '18px',
          padding: '12px 16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ffffff',
              fontWeight: 900,
              fontSize: '18px'
            }}
          >
            {account.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <p style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff' }}>
              {account.name}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 800,
                  background: 'rgba(236, 72, 153, 0.2)',
                  color: 'var(--nw-pink)',
                  padding: '1px 7px',
                  borderRadius: '6px',
                  textTransform: 'uppercase'
                }}
              >
                {account.vehiclePlate}
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {account.vehicleModel || 'Moto'}
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => {
            audioAlert.playClickSound();
            onLogoutAccount();
          }}
          title="Sair da sua conta"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-muted)',
            width: '38px',
            height: '38px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <LogOut size={18} />
        </button>
      </div>

      {/* Card Principal: Iniciar Plantão na Loja */}
      <div
        className="card-surface card-highlight"
        style={{
          padding: '22px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: '12px',
              background: 'rgba(236, 72, 153, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Store size={24} color="var(--nw-pink)" />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>
              Iniciar Plantão na Loja
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Insira o código enviado pela pizzaria para começar a receber pedidos
            </p>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 800,
              color: '#c084fc',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px'
            }}
          >
            Código de Plantão da Loja
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={storeCode}
              onChange={(e) => handleFormatCode(e.target.value)}
              placeholder="NW-XXXXXX"
              maxLength={14}
              style={{
                width: '100%',
                height: '62px',
                background: 'var(--bg-app)',
                border: errorMessage ? '2px solid var(--nw-red)' : '2px solid var(--nw-purple)',
                borderRadius: '16px',
                color: '#ffffff',
                fontSize: '22px',
                fontWeight: 900,
                textAlign: 'center',
                letterSpacing: '2px',
                outline: 'none',
                boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)'
              }}
            />
          </div>
          <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '6px', textAlign: 'center' }}>
            Cada loja gera seu próprio código (ex: NW-BELLA ou NW-1049).
          </p>
        </div>

        {errorMessage && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid var(--nw-red)',
              borderRadius: '12px',
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: '#fca5a5',
              fontSize: '13px',
              fontWeight: 600
            }}
          >
            <AlertCircle size={18} color="var(--nw-red)" style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <button
          onClick={() => handleConnectStore()}
          disabled={loading}
          className="btn-glove btn-glove-accent"
          style={{ height: '64px', fontSize: '16px' }}
        >
          {loading ? (
            <span>Conectando à loja...</span>
          ) : (
            <>
              <KeyRound size={22} />
              <span>Conectar e Iniciar Plantão</span>
              <ArrowRight size={20} />
            </>
          )}
        </button>
      </div>

      {/* Visão Rápida dos Ganhos Acumulados */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(139, 92, 246, 0.15))',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '18px',
          padding: '16px 18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '12px',
              background: 'var(--nw-emerald)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#000000'
            }}
          >
            <Wallet size={24} />
          </div>
          <div>
            <p style={{ fontSize: '11px', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Total Geral a Receber
            </p>
            <p style={{ fontSize: '22px', fontWeight: 900, color: 'var(--nw-emerald)' }}>
              R$ {totalToReceiveAll.toFixed(2).replace('.', ',')}
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            audioAlert.playClickSound();
            onOpenLedgerModal();
          }}
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            color: '#ffffff',
            padding: '8px 14px',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <span>Extrato</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* Histórico & Extrato por Loja Trabalhada */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 900, color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={16} color="var(--nw-pink)" />
            <span>Lojas Onde Você Trabalha ({ledger.length})</span>
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {totalDeliveriesAll} entregas com PIN
          </span>
        </div>

        {ledger.length === 0 ? (
          <div
            className="card-surface"
            style={{
              padding: '24px',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px'
            }}
          >
            <Store size={36} color="var(--text-subtle)" />
            <p style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text-muted)' }}>
              Nenhum plantão registrado ainda
            </p>
            <p style={{ fontSize: '12px', color: 'var(--text-subtle)', maxWidth: '280px', lineHeight: 1.4 }}>
              Assim que você iniciar o plantão em uma pizzaria com o código dela, os valores a receber e o histórico aparecerão aqui.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ledger.map((item) => (
              <div
                key={item.storeId}
                className="card-surface"
                style={{
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>
                      {item.storeName}
                    </h4>
                    {item.storeAddress && (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        {item.storeAddress}
                      </p>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-subtle)', textTransform: 'uppercase', fontWeight: 800, display: 'block' }}>
                      A Receber
                    </span>
                    <span style={{ fontSize: '17px', fontWeight: 900, color: 'var(--nw-emerald)' }}>
                      R$ {item.totalToReceive.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    paddingTop: '8px',
                    borderTop: '1px solid var(--border-subtle)',
                    fontSize: '12px'
                  }}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--nw-emerald)', fontWeight: 700 }}>
                    <CheckCircle size={14} />
                    {item.completedCount} concluídas com PIN
                  </span>

                  {item.canceledCount > 0 && (
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--nw-red)', fontWeight: 700 }}>
                      <XCircle size={14} />
                      {item.canceledCount} desistências
                    </span>
                  )}

                  <span style={{ marginLeft: 'auto', color: 'var(--text-subtle)', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <Calendar size={12} />
                    {new Date(item.lastShiftDate).toLocaleDateString('pt-BR')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ScreenStoreConnect;
