import React, { useState } from 'react';
import { X, Bike, CreditCard, Phone, Power, Sparkles, LogOut, Settings, Download, Smartphone, Sun, Moon } from 'lucide-react';
import { AppUpdateSettings } from './AppUpdateNotice';
import { VersionChangelogModal } from './VersionChangelogModal';
import { ExperienceSettings } from './ExperienceSettings';
import { SectionPushNotifications } from './SectionPushNotifications';
import { OfferSoundSettings } from './OfferSoundSettings';
import { DriverSecuritySettings } from './DriverSecuritySettings';
import { PAYMENT_METHODS, getPaymentMethod, paymentMethodLabel, setPaymentMethod } from '../services/paymentPreference';
import { DriverAccount, DriverSession } from '../types';
import { audioAlert } from '../utils/audioAlert';

function ItemTitle({ children }: { children: React.ReactNode }) {
  return (
    <h5
      style={{
        fontSize: '13px',
        fontWeight: 900,
        color: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
      }}
    >
      {children}
    </h5>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4
      style={{
        fontSize: '11px',
        fontWeight: 900,
        letterSpacing: '.09em',
        textTransform: 'uppercase',
        color: 'var(--text-subtle)',
        margin: '6px 0 -4px',
      }}
    >
      {children}
    </h4>
  );
}

interface ScreenSettingsProps {
  account: DriverAccount;
  activeSession: DriverSession | null;
  onClose: () => void;
  onCloseShift: () => void | Promise<void>;
  onLogoutAccount: () => void;
  onShowToast?: (text: string, type: 'success' | 'error' | 'info') => void;
  currentTheme?: 'dark' | 'light';
  onToggleTheme?: () => void;
}

/**
 * Central única de configurações do entregador.
 *
 * Reúne todas as configurações do sistema em blocos objetivos:
 * Conta & Recebimento, Plantão, Alertas & Som, Segurança & Aparência,
 * Aplicativo & Atualizações e Suporte/Sair da conta.
 */
export const ScreenSettings: React.FC<ScreenSettingsProps> = ({
  account,
  activeSession,
  onClose,
  onCloseShift,
  onLogoutAccount,
  onShowToast,
  currentTheme = 'dark',
  onToggleTheme,
}) => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [paymentMethod, setPaymentMethodState] = useState(() => getPaymentMethod());

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

        <SectionTitle>Conta</SectionTitle>

        {/* Perfil do entregador */}
        <div className="card-surface card-highlight" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <ItemTitle>Meu perfil</ItemTitle>
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

        <ItemTitle>Forma de pagamento</ItemTitle>

        <section className="card-surface" aria-label="Forma de pagamento" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }} role="status">
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
                    audioAlert.playClickSound();
                    const next = active ? null : option.value;
                    setPaymentMethod(next);
                    setPaymentMethodState(next);
                  }}
                  style={{
                    flex: '1 1 auto',
                    minHeight: '44px',
                    padding: '0 12px',
                    borderRadius: '10px',
                    fontSize: '13px',
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
        </section>

        {activeSession && (
          <>
            <SectionTitle>Plantão</SectionTitle>
            <div
              style={{
                background: 'rgba(255, 46, 154, 0.12)', border: '1.5px solid var(--nw-pink)',
                borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <ItemTitle>Plantão atual</ItemTitle>
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
          </>
        )}

        <SectionTitle>Alertas &amp; Som</SectionTitle>

        <SectionPushNotifications onShowToast={onShowToast} />

        <OfferSoundSettings />

        <SectionTitle>Segurança &amp; Aparência</SectionTitle>

        <DriverSecuritySettings />

        {onToggleTheme && (
          <div
            className="card-surface"
            style={{
              padding: '14px 16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {currentTheme === 'dark' ? <Moon size={18} color="var(--nw-purple)" /> : <Sun size={18} color="#f59e0b" />}
              <div>
                <ItemTitle>Tema do aplicativo</ItemTitle>
                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  {currentTheme === 'dark' ? 'Tema Escuro (otimizado para bateria e sol)' : 'Tema Claro'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                audioAlert.playClickSound();
                onToggleTheme();
              }}
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: '#ffffff',
                padding: '8px 14px',
                borderRadius: '10px',
                fontSize: '12px',
                fontWeight: 800,
                cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              Mudar Tema
            </button>
          </div>
        )}

        <ItemTitle>Preferências do app</ItemTitle>

        <ExperienceSettings />

        <SectionTitle>Aplicativo &amp; Atualizações</SectionTitle>

        <ItemTitle>Atualizações</ItemTitle>

        <AppUpdateSettings />

        <section className="card-surface" aria-label="Aplicativo" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Smartphone size={18} color="var(--nw-purple)" />
            <ItemTitle>Baixar o aplicativo</ItemTitle>
          </div>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Instale em outro aparelho ou baixe a versão mais recente direto do site oficial. Não é preciso loja de aplicativos.
          </p>
          <button
            type="button"
            onClick={() => {
              audioAlert.playClickSound();
              window.open('https://painel-moto-three.vercel.app/downloads/', '_blank', 'noopener');
            }}
            className="btn-glove btn-glove-secondary"
            style={{ height: '46px', fontSize: '13px' }}
          >
            <Download size={16} />
            <span>Baixar o aplicativo</span>
          </button>
        </section>

        <ItemTitle>Novidades</ItemTitle>

        <button
          type="button"
          onClick={() => { audioAlert.playClickSound(); setShowChangelog(true); }}
          className="btn-glove btn-glove-secondary"
          style={{ height: '48px', fontSize: '13px' }}
        >
          <Sparkles size={16} color="var(--nw-pink)" />
          <span>O que há de novo no app</span>
        </button>

        {showChangelog && <VersionChangelogModal onClose={() => setShowChangelog(false)} />}

        <SectionTitle>Suporte</SectionTitle>

        <section className="card-surface" aria-label="Suporte" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <ItemTitle>Falar com a loja</ItemTitle>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Dúvida sobre uma entrega? Fale com a loja pelo chat do pedido, na tela da entrega ativa.
          </p>
          <a
            href="https://painel-moto-three.vercel.app/downloads/"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: '12px', color: 'var(--nw-pink)', fontWeight: 800, textDecoration: 'none' }}
          >
            Página oficial do aplicativo
          </a>
          <details>
            <summary style={{ fontSize: '13px', fontWeight: 900, color: '#ffffff', cursor: 'pointer' }}>
              Como o app trata seus dados
            </summary>
            <p style={{ fontSize: '11.5px', color: 'var(--text-subtle)', marginTop: '8px', lineHeight: 1.6 }}>
              Nome, telefone, placa e histórico de entregas ficam na sua conta e são usados apenas para conectar você às lojas
              parceiras. A localização é enviada somente durante o plantão ativo. A forma de pagamento escolhida fica guardada
              neste aparelho e não é enviada para fora.
            </p>
          </details>
        </section>

        {confirmLogout ? (
          <div
            role="alertdialog"
            aria-label="Confirmar saída da conta"
            style={{
              background: 'rgba(239, 68, 68, 0.12)', border: '1.5px solid var(--nw-red)',
              borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px',
            }}
          >
            <strong style={{ fontSize: '13px', color: 'var(--nw-red)' }}>Sair da conta agora?</strong>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Você vai precisar do telefone e do código da loja para entrar de novo.
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={() => { audioAlert.playClickSound(); setConfirmLogout(false); }}
                className="btn-glove btn-glove-secondary"
                style={{ flex: 1, height: '44px', fontSize: '13px' }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => { audioAlert.playClickSound(); onLogoutAccount(); }}
                className="btn-glove btn-glove-danger"
                style={{ flex: 1, height: '44px', fontSize: '13px' }}
              >
                Sair
              </button>
            </div>
          </div>
        ) : (
        <>
        <ItemTitle>Sair da conta</ItemTitle>
        <button
          onClick={() => { audioAlert.playClickSound(); setConfirmLogout(true); }}
          className="btn-glove"
          style={{
            height: '50px', fontSize: '13px', background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', color: 'var(--nw-red)', marginTop: '8px',
          }}
        >
          <LogOut size={16} />
          <span>Sair da Minha Conta de Entregador</span>
        </button>
        </>
        )}
      </div>
    </div>
  );
};
