import React, { useState } from 'react';
import { X, Bike, CreditCard, Phone, Power, Sparkles, LogOut, Settings } from 'lucide-react';
import { AppUpdateSettings } from './AppUpdateNotice';
import { VersionChangelogModal } from './VersionChangelogModal';
import { ExperienceSettings } from './ExperienceSettings';
import { SectionPushNotifications } from './SectionPushNotifications';
import { DriverAccount, DriverSession } from '../types';
import { audioAlert } from '../utils/audioAlert';

interface ScreenSettingsProps {
  account: DriverAccount;
  activeSession: DriverSession | null;
  onClose: () => void;
  onCloseShift: () => void | Promise<void>;
  onLogoutAccount: () => void;
  onShowToast?: (text: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Configurações do entregador.
 *
 * Tudo que NÃO é dinheiro saiu do extrato e vive aqui: perfil (nome, telefone,
 * placa, moto), notificações, preferências de experiência, atualização do app,
 * novidades, encerrar plantão e sair da conta. O extrato ficou só com o extrato.
 */
export const ScreenSettings: React.FC<ScreenSettingsProps> = ({
  account,
  activeSession,
  onClose,
  onCloseShift,
  onLogoutAccount,
  onShowToast,
}) => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [closingShift, setClosingShift] = useState(false);

  const handleEndShift = async () => {
    if (!activeSession) return;
    setClosingShift(true);
    audioAlert.playClickSound();
    try {
      await onCloseShift();
    } finally {
      setClosingShift(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(event) => event.stopPropagation()}
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Settings size={22} color="var(--nw-pink)" />
            <h3 style={{ fontSize: '18px', fontWeight: 900 }}>Configurações</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Fechar configurações"
            style={{
              background: 'var(--bg-elevated)', border: 'none', color: 'var(--text-muted)',
              width: '36px', height: '36px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Perfil do entregador */}
        <div className="card-surface card-highlight" style={{ padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '50px', height: '50px', borderRadius: '16px',
                background: 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#ffffff', fontWeight: 900, fontSize: '22px',
              }}
            >
              {account.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h4 style={{ fontSize: '18px', fontWeight: 900, color: '#ffffff' }}>{account.name}</h4>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <Phone size={12} />
                {account.phone}
              </p>
            </div>
          </div>

          <div
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '12px',
              paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', fontSize: '12px',
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

        {/* Plantão ativo: encerrar aqui, não no extrato */}
        {activeSession && (
          <div
            style={{
              background: 'rgba(255, 46, 154, 0.12)', border: '1.5px solid var(--nw-pink)',
              borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
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
            <h4 style={{ fontSize: '16px', fontWeight: 900, color: '#ffffff' }}>{activeSession.storeName}</h4>
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

        <SectionPushNotifications onShowToast={onShowToast} />

        <ExperienceSettings />
        <AppUpdateSettings />

        <button
          type="button"
          onClick={() => { audioAlert.playClickSound(); setShowChangelog(true); }}
          className="btn-glove btn-glove-secondary"
          style={{ height: '48px', fontSize: '13px' }}
        >
          <Sparkles size={16} color="var(--nw-pink)" />
          <span>✨ O que há de novo no app (Novidades)</span>
        </button>

        {showChangelog && <VersionChangelogModal onClose={() => setShowChangelog(false)} />}

        <button
          onClick={() => { audioAlert.playClickSound(); onLogoutAccount(); }}
          className="btn-glove"
          style={{
            height: '50px', fontSize: '13px', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', color: 'var(--nw-red)', marginTop: '8px',
          }}
        >
          <LogOut size={16} />
          <span>Sair da Minha Conta de Entregador</span>
        </button>
      </div>
    </div>
  );
};
