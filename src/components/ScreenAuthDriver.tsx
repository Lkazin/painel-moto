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
  HelpCircle,
  X,
  Package,
  ShieldCheck,
  Headphones,
  Smartphone
} from 'lucide-react';
import './ScreenAuthDriver.css';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverAccount } from '../types';
import { PWAInstallModal } from './PWAInstallModal';

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
      const account = mode === 'register'
        ? await api.registerDriver(name,loginIdentifier,plate,model,loginPassword)
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
          <div style={{display:'flex',gap:8,marginBottom:20}}>
            <button type="button" className="nwl-submit" aria-pressed={mode === 'login'} onClick={() => {setMode('login');setErrorMessage(null);}} disabled={loading}>Entrar</button>
            <button type="button" className="nwl-submit" aria-pressed={mode === 'register'} onClick={() => {setMode('register');setErrorMessage(null);}} disabled={loading}>Criar conta</button>
          </div>
          <p style={{fontSize:12,marginBottom:16}}>Para recuperar seu vínculo e histórico antigos, peça ao lojista para vincular sua conta cadastrada. Depois, use o mesmo telefone e senha nos outros aparelhos.</p>
          {notice && <p className="nwl-error" role="alert">{notice}</p>}
          <form onSubmit={handleLogin} className="nwl-form">
            {mode === 'register' && <>
              <div><label htmlFor="nwl-name" className="nwl-label">Nome completo</label><input id="nwl-name" className="nwl-input" value={name} onChange={event => setName(event.target.value)} autoComplete="name" required minLength={3} maxLength={120}/></div>
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
              <input id="nwl-password-confirmation" className="nwl-input" type={showPassword ? 'text' : 'password'} value={passwordConfirmation} onChange={event => setPasswordConfirmation(event.target.value)} autoComplete="new-password" minLength={8} required/>
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
            <span>Baixar Aplicativo no Celular (Android / iPhone)</span>
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
            Todos os direitos reservados • Versão 2.4.0 (Build Seguro)
          </p>
          <p className="nwl-company-legal">
            CNPJ &amp; Infraestrutura Cloud em conformidade com a LGPD (Lei Nº 13.709/2018)
          </p>
        </div>
      </footer>
      </div>

      {/* MODAL DE POLÍTICA DE PRIVACIDADE E TERMOS */}
      {activeModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.85)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
            zIndex: 9999
          }}
          onClick={() => setActiveModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '20px',
              maxWidth: '480px',
              width: '100%',
              maxHeight: '80vh',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
            }}
          >
            {/* Header Modal */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'between',
                width: '100%'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                {activeModal === 'privacy' && <Shield size={18} color="var(--nw-pink)" />}
                {activeModal === 'terms' && <FileText size={18} color="var(--nw-pink)" />}
                {activeModal === 'support' && <HelpCircle size={18} color="var(--nw-pink)" />}
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 800, color: '#ffffff' }}>
                  {activeModal === 'privacy' && 'Política de Privacidade (LGPD)'}
                  {activeModal === 'terms' && 'Termos de Uso do Entregador'}
                  {activeModal === 'support' && 'Suporte e Atendimento NovaesWeb'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Conteúdo Modal */}
            <div
              style={{
                padding: '20px',
                overflowY: 'auto',
                fontSize: '13px',
                color: 'var(--text-muted)',
                lineHeight: 1.6,
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              {activeModal === 'privacy' && (
                <>
                  <p>
                    <strong style={{ color: '#ffffff' }}>1. Coleta e Finalidade da Localização:</strong> O aplicativo NovaesWeb coleta dados de geolocalização do entregador exclusivamente durante o período em que uma rota de entrega estiver ativa (após a confirmação de retirada no estabelecimento até a validação do PIN de entrega).
                  </p>
                  <p>
                    <strong style={{ color: '#ffffff' }}>2. Proteção de Dados (LGPD):</strong> Nenhum dado de localização é transmitido ou exibido antes da saída do estabelecimento ou após a finalização da entrega. As informações são criptografadas e não são comercializadas com terceiros.
                  </p>
                  <p>
                    <strong style={{ color: '#ffffff' }}>3. Armazenamento e Histórico:</strong> Registros operacionais de entregas concluídas permanecem vinculados à conta do entregador de forma protegida para fins de conferência financeira e relatórios.
                  </p>
                </>
              )}

              {activeModal === 'terms' && (
                <>
                  <p>
                    <strong style={{ color: '#ffffff' }}>1. Uso da Plataforma:</strong> O acesso ao painel do entregador destina-se ao recebimento, gestão e conferência de ordens de entrega despachadas pelos estabelecimentos parceiros credenciados.
                  </p>
                  <p>
                    <strong style={{ color: '#ffffff' }}>2. Validação de Entrega (PIN):</strong> É de responsabilidade do entregador solicitar e confirmar o código PIN de 4 dígitos informado pelo cliente no momento da entrega presencial para liberação e baixa segura da comanda.
                  </p>
                  <p>
                    <strong style={{ color: '#ffffff' }}>3. Vínculo com Estabelecimentos:</strong> Os códigos de vínculo (<code style={{ color: '#facc15' }}>NW-XXXXXX</code>) fornecidos pelas lojas possuem validade pré-determinada e podem ser revogados pelo estabelecimento conforme normas operacionais internas.
                  </p>
                </>
              )}

              {activeModal === 'support' && (
                <>
                  <p>
                    <strong style={{ color: '#ffffff' }}>Central de Ajuda NovaesWeb:</strong>
                  </p>
                  <p>
                    Para dúvidas sobre códigos de vínculo, plantões e taxas de entrega, consulte diretamente o gerente ou operador do estabelecimento parceiro.
                  </p>
                  <p>
                    Para suporte técnico relativo ao aplicativo, falhas de sincronização ou redefinição de acesso, contate nosso time de tecnologia pelo suporte operacional:
                  </p>
                  <div
                    style={{
                      background: 'var(--bg-app)',
                      padding: '12px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      fontWeight: 700,
                      color: '#ffffff'
                    }}
                  >
                    📧 suporte@novaesweb.com.br<br />
                    📱 WhatsApp de Suporte: (11) 99999-0000
                  </div>
                </>
              )}
            </div>

            {/* Footer Modal */}
            <div
              style={{
                padding: '14px 20px',
                borderTop: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'flex-end'
              }}
            >
              <button
                type="button"
                onClick={() => setActiveModal(null)}
                className="btn-glove"
                style={{ height: '42px', padding: '0 20px', fontSize: '13px' }}
              >
                Entendi e Fechar
              </button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL DE INSTALAÇÃO PWA MOBILE (ANDROID & IOS) */}
      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
    </div>
  );
};

export default ScreenAuthDriver;
