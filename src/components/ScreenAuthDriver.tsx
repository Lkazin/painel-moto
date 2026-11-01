import React, { useState } from 'react';
import {
  Phone,
  Lock,
  Bike,
  ArrowRight,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  Shield,
  FileText,
  Package,
  ShieldCheck,
  Headphones,
  Smartphone,
  Store,
  CheckCircle,
  Sparkles
} from 'lucide-react';
import './ScreenAuthDriver.css';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverAccount } from '../types';
import { PWAInstallModal } from './PWAInstallModal';
import { AccountInformationModal } from './AccountInformationModal';

interface ScreenAuthDriverProps {
  onLoginSuccess: (account: DriverAccount) => void;
  notice?: string;
}

export const ScreenAuthDriver: React.FC<ScreenAuthDriverProps> = ({ onLoginSuccess, notice }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [plate, setPlate] = useState('');
  const [model, setModel] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [registrationCode, setRegistrationCode] = useState('');
  const [verifiedStoreName, setVerifiedStoreName] = useState<string | null>(null);
  const [codeStatus, setCodeStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');

  const handleCodeChange = async (val: string) => {
    let clean = val.toUpperCase().replace(/[\s]/g, '');
    if (!clean.startsWith('NW-') && clean.length > 0) {
      if (clean.startsWith('NW')) {
        clean = 'NW-' + clean.slice(2).replace(/-/g, '');
      } else {
        clean = 'NW-' + clean.replace(/-/g, '');
      }
    }
    setRegistrationCode(clean);
    setErrorMessage(null);

    if (clean.length >= 6) {
      setCodeStatus('checking');
      try {
        const res = await api.verifyStoreCode(clean);
        if (res.valid && res.storeName) {
          setVerifiedStoreName(res.storeName);
          setCodeStatus('valid');
        } else {
          setVerifiedStoreName(null);
          setCodeStatus('invalid');
        }
      } catch {
        setCodeStatus('idle');
      }
    } else {
      setCodeStatus('idle');
      setVerifiedStoreName(null);
    }
  };
  // Conta centralizada, compartilhada entre aparelhos.
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modais de Informações Legais / Rodapé
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'support' | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      setErrorMessage('Informe seu telefone com DDD.');
      audioAlert.playErrorSound();
      return;
    }
    if (!loginPassword) {
      setErrorMessage('Informe sua senha de acesso.');
      audioAlert.playErrorSound();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    audioAlert.playClickSound();

    try {
      if (mode === 'register' && loginPassword.length < 8) throw new Error('A senha deve ter pelo menos 8 caracteres.');
      if (mode === 'register' && loginPassword !== passwordConfirmation) throw new Error('As senhas precisam ser iguais.');
      if (mode === 'register') {
        if (!name.trim() || name.trim().length < 3) throw new Error('Informe seu nome completo.');
        if (!plate.trim() || plate.trim().length < 5) throw new Error('Informe a placa da moto.');
        if (!model.trim()) throw new Error('Informe o modelo da moto.');
        if (!registrationCode.trim() || registrationCode.trim().length < 5) {
          throw new Error('Informe o código de autorização fornecido pela loja (ex: NW-XXXXXX).');
        }
        if (codeStatus === 'invalid') {
          throw new Error('O código de autorização informado não é válido, expirou ou já foi utilizado.');
        }
      }
      const account = mode === 'register'
        ? await api.registerDriver(name,loginIdentifier,plate,model,loginPassword,registrationCode)
        : await api.loginDriver(loginIdentifier, loginPassword);
      audioAlert.playSuccessSound();
      onLoginSuccess(account);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Falha no login. Verifique seus dados.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="nwl-root">
      <div className="nwl-bg" aria-hidden="true" />

      <div className="nwl-content">
      <div className="nwl-main">
        {/* Cabeçalho */}
        <header className="nwl-header">
          <div className="nwl-logo">
            <Bike size={46} color="#ffffff" strokeWidth={2.4} />
          </div>

          <h1 className="nwl-title">
            NovaesWeb <span className="nwl-title-accent">Entregador</span>
          </h1>

          <span className="nwl-badge">
            <Package size={16} color="#F5B6D7" />
            Painel do Entregador
          </span>

          <p className="nwl-subtitle">
            Sua conta acompanha você no celular e no computador. Ao entrar em outro aparelho, o acesso anterior é desconectado.
          </p>
        </header>

        {/* Formulário Principal de Login */}
        <div className="nwl-card">
          <div className="nwl-account-switch" aria-label="Acesso à conta">
            <button type="button" className="nwl-account-option" aria-pressed={mode === 'login'} onClick={() => {setMode('login');setErrorMessage(null);}} disabled={loading}>Entrar</button>
            <button type="button" className="nwl-account-option" aria-pressed={mode === 'register'} onClick={() => {setMode('register');setErrorMessage(null);}} disabled={loading}>Criar conta</button>
          </div>
          <p className="nwl-account-hint">{mode === 'register' ? 'Seu primeiro acesso começa com o código de cadastro enviado pela loja.' : 'Entre com o mesmo telefone e senha em qualquer aparelho. Só um acesso fica conectado por vez.'}</p>
          {notice && <p className="nwl-error" role="alert">{notice}</p>}
          <form onSubmit={handleLogin} className="nwl-form">
            {mode === 'register' && <>
              <div>
                <label htmlFor="nwl-registration-code" className="nwl-label">
                  <Store size={15} color="#F8F5FC" />
                  Código de autorização da loja
                </label>
                <div className="nwl-field">
                  <input
                    id="nwl-registration-code"
                    className="nwl-input"
                    value={registrationCode}
                    onChange={(e) => handleCodeChange(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      handleCodeChange(pasted);
                    }}
                    placeholder="Ex: NW-8K72P"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    maxLength={12}
                    required
                  />
                  <Store size={18} color="#754B98" className="nwl-input-icon" />
                </div>

                {/* Feedback dinâmico da loja */}
                {codeStatus === 'checking' && (
                  <div style={{ marginTop: '7px', fontSize: '12px', color: '#FFB3E0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={14} className="spin-slow" />
                    <span>Consultando autorização com a loja...</span>
                  </div>
                )}

                {codeStatus === 'valid' && verifiedStoreName && (
                  <div style={{
                    marginTop: '7px',
                    padding: '8px 12px',
                    background: 'rgba(16, 185, 129, 0.18)',
                    border: '1.5px solid rgba(16, 185, 129, 0.6)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12.5px',
                    color: '#ffffff',
                    fontWeight: 700
                  }}>
                    <CheckCircle size={16} color="#10b981" style={{ flexShrink: 0 }} />
                    <span>Loja autorizada: <strong style={{ color: '#6ee7b7' }}>{verifiedStoreName}</strong> ✅</span>
                  </div>
                )}

                {codeStatus === 'invalid' && (
                  <div style={{
                    marginTop: '7px',
                    padding: '8px 12px',
                    background: 'rgba(255, 61, 110, 0.18)',
                    border: '1.5px solid rgba(255, 61, 110, 0.6)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '12.5px',
                    color: '#ffffff',
                    fontWeight: 600
                  }}>
                    <AlertCircle size={16} color="#FF3D6E" style={{ flexShrink: 0 }} />
                    <span style={{ color: '#FFB3E0' }}>Código não encontrado, expirado ou já utilizado pela loja.</span>
                  </div>
                )}

                <p id="nwl-registration-code-help" className="nwl-account-hint" style={{ marginTop: '6px' }}>
                  Solicite este código exclusivo ao lojista para o qual você deseja prestar serviços de entrega.
                </p>
              </div>
              <div><label htmlFor="nwl-name" className="nwl-label">Nome completo</label><input id="nwl-name" className="nwl-input" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required minLength={3} maxLength={100}/></div>
              <div><label htmlFor="nwl-plate" className="nwl-label">Placa da moto</label><input id="nwl-plate" className="nwl-input" value={plate} onChange={event => setPlate(event.target.value.toUpperCase())} required maxLength={10}/></div>
              <div><label htmlFor="nwl-model" className="nwl-label">Modelo da moto</label><input id="nwl-model" className="nwl-input" value={model} onChange={event => setModel(event.target.value)} required maxLength={100}/></div>
            </>}
            <div>
              <label htmlFor="nwl-login-identifier" className="nwl-label">
                <Phone size={16} color="#F8F5FC" />
                Telefone com DDD
              </label>
              <div className="nwl-field">
                <input
                  id="nwl-login-identifier"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="(11) 98765-4321"
                  autoFocus
                  className="nwl-input"
                />
                <Phone size={20} color="#754B98" className="nwl-input-icon" />
              </div>
            </div>

            <div>
              <label htmlFor="nwl-login-password" className="nwl-label">
                <Lock size={16} color="#F8F5FC" />
                Senha de Acesso
              </label>
              <div className="nwl-field">
                <input
                  id="nwl-login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                  minLength={mode === 'register' ? 8 : undefined}
                  maxLength={128}
                  required
                  placeholder="••••••••"
                  className="nwl-input nwl-input--password"
                />
                <Lock size={20} color="#754B98" className="nwl-input-icon" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="nwl-eye-btn"
                  aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {mode === 'register' && <div>
              <label htmlFor="nwl-password-confirmation" className="nwl-label">Confirmar senha</label>
              <input id="nwl-password-confirmation" className="nwl-input" type={showPassword ? 'text' : 'password'} value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required/>
              <p style={{fontSize:12,marginTop:8}}>Use pelo menos 8 caracteres. Guarde sua senha; a recuperação por telefone ainda não está disponível.</p>
            </div>}
            {errorMessage && (
              <div className="nwl-error" role="alert">
                <AlertCircle size={20} color="#C85B75" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="nwl-submit"
            >
              {loading ? (
                <span>Autenticando...</span>
              ) : (
                <>
                  <LogIn size={22} />
                  <span>{mode === 'register' ? 'Criar minha conta' : 'Entrar no aplicativo'}</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
            <p className="nwl-account-legal">Conheça nossos <button type="button" onClick={() => setActiveModal('terms')}>Termos de Uso</button> e saiba como utilizamos seus dados na <button type="button" onClick={() => setActiveModal('privacy')}>Política de Privacidade</button>.</p>
          </form>
        </div>

        <div className="nwl-secure">
          <ShieldCheck size={26} color="#D97BB9" style={{ flexShrink: 0 }} />
          <span>Conexão protegida. Uma conta, um aparelho conectado por vez.</span>
        </div>

        {/* Botão Oficial para Instalar no Celular (Android / iOS) */}
        <div style={{ width: '100%', marginTop: '4px' }}>
          <button
            type="button"
            onClick={() => {
              audioAlert.playClickSound();
              setShowInstallModal(true);
            }}
            className="nwl-install-app-btn"
          >
            <Smartphone size={19} color="#FFB3E0" />
            <span>Instalar no celular (Android / iPhone)</span>
          </button>
        </div>
      </div>

      {/* RODAPÉ OFICIAL NOVAESWEB */}
      <footer className="nwl-footer">
        {/* Links Rápidos: Política de Privacidade, Termos e Ajuda */}
        <div className="nwl-links">
          <button
            type="button"
            onClick={() => setActiveModal('privacy')}
            className="nwl-link"
          >
            <Shield size={17} color="#F5B6D7" />
            Política de Privacidade
          </button>

          <span className="nwl-divider" aria-hidden="true" />

          <button
            type="button"
            onClick={() => setActiveModal('terms')}
            className="nwl-link"
          >
            <FileText size={17} color="#F5B6D7" />
            Termos de Uso
          </button>
        </div>

        <button
          type="button"
          onClick={() => setActiveModal('support')}
          className="nwl-support"
        >
          <Headphones size={17} color="#F5B6D7" />
          Ajuda / Suporte
        </button>

        {/* Informações da Plataforma */}
        <div className="nwl-company">
          <p className="nwl-company-name">
            NovaesWeb Tecnologia &amp; Logística Integrada
          </p>
          <p>
            Sua conta. Suas entregas. Onde você estiver.
          </p>
          <p className="nwl-company-legal">
            Consulte os termos, a privacidade e os canais de atendimento.
          </p>
        </div>
      </footer>
      </div>

      {activeModal && <AccountInformationModal page={activeModal} onClose={() => setActiveModal(null)} />}
      {/* MODAL DE INSTALAÇÃO PWA MOBILE (ANDROID & IOS) */}
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
};

export default ScreenAuthDriver;
