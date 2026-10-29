import React, { useState } from 'react';
import {
  X,
  Store,
  Smartphone,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  Power
} from 'lucide-react';
import { DriverSession } from '../types';
import { offlineQueue } from '../services/offlineQueue';
import { audioAlert } from '../utils/audioAlert';
import { api } from '../services/api';

interface ModalSessionAndStoreProps {
  session: DriverSession;
  onClose: () => void;
  onLogout: () => void;
  onCloseShift?: () => void;
  onToggleTheme: () => void;
  currentTheme: 'dark' | 'light';
  pendingDeliveriesCount?: number;
}

export const ModalSessionAndStore: React.FC<ModalSessionAndStoreProps> = ({
  session,
  onClose,
  onLogout,
  onCloseShift,
  onToggleTheme,
  currentTheme
}) => {
  const [isFlushingQueue, setIsFlushingQueue] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  const pendingCount = offlineQueue.getPendingCount();
  const isOnline = offlineQueue.getIsOnline();

  const handleFlushQueue = async () => {
    if (!isOnline) {
      setFlushMessage('Aparelho offline. A sincronização ocorrerá automaticamente ao reconectar.');
      return;
    }

    setIsFlushingQueue(true);
    setFlushMessage(null);
    audioAlert.playClickSound();

    try {
      const res = await api.flushOfflineQueue();
      if (res.syncedCount > 0) {
        audioAlert.playSuccessSound();
        setFlushMessage(`${res.syncedCount} ações sincronizadas com a loja!`);
      } else {
        setFlushMessage('Todas as pendências estão sincronizadas.');
      }
    } catch {
      audioAlert.playErrorSound();
      setFlushMessage('Falha de conexão. O app tentará novamente em segundo plano.');
    } finally {
      setIsFlushingQueue(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        {/* Topo do Modal */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Store size={22} color="var(--nw-pink)" />
            <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Vínculo & Configurações</h3>
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

        {/* Card da Loja Ativa */}
        <div className="card-surface card-highlight" style={{ padding: '16px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase' }}>
              Loja Vinculada
            </span>
            <span style={{ fontSize: '10px', background: 'var(--nw-emerald)', color: '#000', fontWeight: 900, padding: '2px 8px', borderRadius: '8px' }}>
              ATIVA
            </span>
          </div>
          <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginTop: '4px' }}>
            {session.storeName}
          </h4>
          {session.storeAddress && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              {session.storeAddress}
            </p>
          )}

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '11px', color: 'var(--text-subtle)' }}>
            <span>Vínculo: {session.membershipId}</span>
            <span>Expira em: {new Date(session.expiresAt).toLocaleDateString('pt-BR')}</span>
          </div>
        </div>

        {/* Card do Entregador & Aparelho */}
        <div className="card-surface" style={{ padding: '14px', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Smartphone size={20} color="var(--nw-purple)" />
            <div>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff' }}>
                {session.driverName}
              </p>
              <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                {session.vehiclePlate ? `${session.vehiclePlate} • ` : ''}{session.phone}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-subtle)' }}>
            Fingerprint do Aparelho: <code style={{ color: '#d8b4fe' }}>{session.deviceFingerprint}</code>
          </div>
        </div>

        {/* Status de Conexão Real */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {isOnline ? <Wifi size={20} color="var(--nw-emerald)" /> : <WifiOff size={20} color="var(--nw-red)" />}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 800 }}>Conexão de Rede</p>
                <p style={{ fontSize: '11px', color: isOnline ? 'var(--nw-emerald)' : 'var(--nw-red)', fontWeight: 700 }}>
                  {isOnline ? 'Online • Conectado à API Central' : 'Sem Internet • Modo Offline Ativo'}
                </p>
              </div>
            </div>
          </div>

          {/* Sincronização Manual de Fila Offline */}
          {pendingCount > 0 && (
            <div
              style={{
                background: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid var(--nw-amber)',
                borderRadius: '14px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div>
                <p style={{ fontSize: '13px', fontWeight: 800, color: '#fef08a' }}>
                  {pendingCount} ações na fila offline
                </p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Aguardando envio ao servidor
                </p>
              </div>
              <button
                onClick={handleFlushQueue}
                disabled={isFlushingQueue || !isOnline}
                style={{
                  background: 'var(--nw-amber)',
                  color: '#000',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: !isOnline ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <RefreshCw size={13} className={isFlushingQueue ? 'spin' : ''} />
                <span>Sincronizar</span>
              </button>
            </div>
          )}

          {flushMessage && (
            <div style={{ fontSize: '12px', color: 'var(--nw-emerald)', textAlign: 'center', fontWeight: 700 }}>
              {flushMessage}
            </div>
          )}

          {/* Alternador de Tema Claro / Escuro */}
          <div
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '14px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {currentTheme === 'dark' ? <Moon size={20} color="var(--nw-purple)" /> : <Sun size={20} color="#f59e0b" />}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 800 }}>Aparência</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {currentTheme === 'dark' ? 'Tema Escuro (Otimizado p/ Sol e Bateria)' : 'Tema Claro'}
                </p>
              </div>
            </div>
            <button
              onClick={onToggleTheme}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Mudar Tema
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {onCloseShift && (
            <button
              onClick={() => {
                audioAlert.playClickSound();
                onCloseShift();
              }}
              className="btn-glove btn-glove-accent"
              style={{ height: '54px', fontSize: '14px' }}
            >
              <Power size={18} />
              <span>Encerrar Plantão nesta Loja (Salvar no Extrato)</span>
            </button>
          )}

          <button
            onClick={onLogout}
            className="btn-glove btn-glove-danger"
            style={{ height: '48px', fontSize: '13px' }}
          >
            <LogOut size={16} />
            <span>Sair da Conta do Entregador</span>
          </button>
        </div>

        <p style={{ fontSize: '10px', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '10px' }}>
          Ao encerrar o plantão, seus ganhos e entregas ficam salvos no seu extrato pessoal.
        </p>
      </div>
    </div>
  );
};
