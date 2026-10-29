import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, KeyRound, ArrowRight, Smartphone } from 'lucide-react';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverSession } from '../types';

interface ScreenActivationProps {
  onActivated: (session: DriverSession) => void;
}

export const ScreenActivation: React.FC<ScreenActivationProps> = ({ onActivated }) => {
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Gera ou resgata fingerprint único do aparelho
  const getDeviceFingerprint = () => {
    let fp = localStorage.getItem('novaesweb_device_fp');
    if (!fp) {
      fp = 'dev_fp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem('novaesweb_device_fp', fp);
    }
    return fp;
  };

  const handleFormatCode = (val: string) => {
    let clean = val.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    if (!clean.startsWith('NW-') && clean.length > 0) {
      if (clean.startsWith('NW')) {
        clean = 'NW-' + clean.substring(2);
      } else {
        clean = 'NW-' + clean.replace(/-/g, '');
      }
    }
    setInviteCode(clean);
    setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || inviteCode.length < 6) {
      setErrorMessage('Digite o código de 6 dígitos emitido pela loja (ex: NW-123456).');
      audioAlert.playErrorSound();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    audioAlert.playClickSound();

    try {
      const fingerprint = getDeviceFingerprint();
      const session = await api.activateInvite(inviteCode, fingerprint);
      audioAlert.playSuccessSound();
      onActivated(session);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Código inválido ou não autorizado pela loja.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '24px', minHeight: '85vh', justifyContent: 'center' }}>
      {/* Brand Hero */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div
          style={{
            width: '84px',
            height: '84px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 30px var(--nw-pink-glow)'
          }}
        >
          <KeyRound size={42} color="#ffffff" strokeWidth={2.4} />
        </div>
        <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px', marginTop: '6px' }}>
          NovaesWeb <span style={{ color: 'var(--nw-pink)' }}>Entregador</span>
        </h1>
        <p style={{ fontSize: '14px', color: 'var(--text-muted)', maxWidth: '320px', lineHeight: 1.5 }}>
          Aplicativo universal para entregadores. Insira o código de uso único fornecido pelo lojista para ativar o seu aparelho.
        </p>
      </div>

      {/* Card do Formulário */}
      <div className="card-surface card-highlight" style={{ padding: '24px' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 800, color: '#c084fc', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Código de Ativação da Loja
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => handleFormatCode(e.target.value)}
                placeholder="NW-123456"
                maxLength={12}
                autoFocus
                style={{
                  width: '100%',
                  height: '64px',
                  background: 'var(--bg-app)',
                  border: errorMessage ? '2px solid var(--nw-red)' : '2px solid var(--nw-purple)',
                  borderRadius: '16px',
                  color: '#ffffff',
                  fontSize: '24px',
                  fontWeight: 900,
                  textAlign: 'center',
                  letterSpacing: '2px',
                  outline: 'none',
                  boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.5)'
                }}
              />
            </div>
            <p style={{ fontSize: '11px', color: 'var(--text-subtle)', marginTop: '6px', textAlign: 'center' }}>
              Código válido conforme prazo estipulado na emissão (ex: 3, 10 ou 30 dias).
            </p>
          </div>

          {errorMessage && (
            <div
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid var(--nw-red)',
                borderRadius: '12px',
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#fca5a5',
                fontSize: '13px',
                fontWeight: 600
              }}
            >
              <AlertCircle size={20} color="var(--nw-red)" style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-glove btn-glove-accent"
            style={{ marginTop: '8px' }}
          >
            {loading ? (
              <span>Validando com o servidor...</span>
            ) : (
              <>
                <ShieldCheck size={22} />
                <span>Ativar Aparelho</span>
                <ArrowRight size={20} />
              </>
            )}
          </button>
        </form>
      </div>

      {/* Rodapé de Informação de Aparelho */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: 'var(--text-subtle)', fontSize: '12px' }}>
        <Smartphone size={15} />
        <span>Política de Sessão Única por Aparelho</span>
      </div>
    </div>
  );
};
