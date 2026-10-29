import React, { useState } from 'react';
import {
  X,
  Store,
  Shield,
  Smartphone,
  Wifi,
  WifiOff,
  Sun,
  Moon,
  Volume2,
  LogOut,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { DriverSession } from '../types';
import { offlineQueue } from '../services/offlineQueue';
import { audioAlert } from '../utils/audioAlert';
import { api } from '../services/api';

interface ModalSessionAndStoreProps {
  session: DriverSession;
  onClose: () => void;
  onLogout: () => void;
  onToggleTheme: () => void;
  currentTheme: 'dark' | 'light';
}

export const ModalSessionAndStore: React.FC<ModalSessionAndStoreProps> = ({
  session,
  onClose,
  onLogout,
  onToggleTheme,
  currentTheme
}) => {
  const [isSimulatedOffline, setIsSimulatedOffline] = useState(offlineQueue.getIsSimulated());
  const [isFlushingQueue, setIsFlushingQueue] = useState(false);
  const [flushMessage, setFlushMessage] = useState<string | null>(null);

  const pendingCount = offlineQueue.getPendingCount();

  const handleToggleOffline = () => {
    audioAlert.playClickSound();
    const state = offlineQueue.toggleSimulatedOffline();
    setIsSimulatedOffline(state);
    if (!state) {
      handleFlushQueue();
    }
  };

  const handleFlushQueue = async () => {
    setIsFlushingQueue(true);
    setFlushMessage(null);
    audioAlert.playClickSound();
    try {
      const res = await api.flushOfflineQueue();
      if (res.syncedCount > 0) {
        audioAlert.playSuccessSound();
        setFlushMessage(`${res.syncedCount} ações sincronizadas com a loja!`);
      } else {
        setFlushMessage('Fila vazia. Tudo em dia!');
      }
    } catch {
      audioAlert.playErrorSound();
      setFlushMessage('Falha ao sincronizar. Tentará automaticamente ao reconectar.');
    } finally {
      setIsFlushingQueue(false);
    }
  };

  const handleTestSound = () => {
    audioAlert.playOfferChime();
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
          <span style={{ fontSize: '11px', fontWeight: 800, color: '#c084fc', textTransform: 'uppercase' }}>
            Loja Ativa Vinculada
          </span>
          <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff', marginTop: '2px' }}>
            {session.storeName}
          </h4>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {session.storeAddress || 'Rua das Camélias, 412 - Jardins, SP'}
          </p>

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
                {session.vehiclePlate} • {session.phone}
              </p>
            </div>
          </div>
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-subtle)' }}>
            Fingerprint: <code style={{ color: '#d8b4fe' }}>{session.deviceFingerprint}</code>
          </div>
        </div>

        {/* Controles do Sistema */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '18px' }}>
          {/* Alternador de Modo Offline (Simulador para Testes) */}
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
              {isSimulatedOffline ? <WifiOff size={20} color="var(--nw-amber)" /> : <Wifi size={20} color="var(--nw-emerald)" />}
              <div>
                <p style={{ fontSize: '13px', fontWeight: 800 }}>Simular Modo Sem Internet</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {isSimulatedOffline ? 'Modo avião simulado ATIVO' : 'Conectado normalmente'}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleOffline}
              style={{
                background: isSimulatedOffline ? 'var(--nw-amber)' : 'var(--bg-elevated)',
                color: isSimulatedOffline ? '#000000' : '#ffffff',
                border: 'none',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {isSimulatedOffline ? 'Desativar' : 'Ativar'}
            </button>
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
                  Aguardando reconexão para validação
                </p>
              </div>
              <button
                onClick={handleFlushQueue}
                disabled={isFlushingQueue || isSimulatedOffline}
                style={{
                  background: 'var(--nw-amber)',
                  color: '#000',
                  border: 'none',
                  padding: '6px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  fontWeight: 800,
                  cursor: isSimulatedOffline ? 'not-allowed' : 'pointer',
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

          {/* Botão de Testar Som de Oferta */}
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
              <Volume2 size={20} color="var(--nw-pink)" />
              <div>
                <p style={{ fontSize: '13px', fontWeight: 800 }}>Testar Alarme Sonoro</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  Sintetizador Web Audio API de 60s
                </p>
              </div>
            </div>
            <button
              onClick={handleTestSound}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--nw-pink)',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '11px',
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              Tocar Bipe
            </button>
          </div>

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
                <p style={{ fontSize: '13px', fontWeight: 800 }}>Aparência da Tela</p>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                  {currentTheme === 'dark' ? 'Tema Escuro (Economia de Bateria)' : 'Tema Claro (Alta Luz)'}
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

        {/* Botão de Encerrar Sessão do Aparelho */}
        <button
          onClick={onLogout}
          className="btn-glove btn-glove-danger"
          style={{ height: '52px', fontSize: '14px' }}
        >
          <LogOut size={18} />
          <span>Sair deste Aparelho (Revogar Sessão)</span>
        </button>

        <p style={{ fontSize: '10px', color: 'var(--text-subtle)', textAlign: 'center', marginTop: '10px' }}>
          Ao revogar o acesso, será necessário um novo código emitido pela loja para reativar este ou outro aparelho.
        </p>
      </div>
    </div>
  );
};
