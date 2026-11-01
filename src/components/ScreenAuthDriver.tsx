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
  Headphones
} from 'lucide-react';
import './ScreenAuthDriver.css';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverAccount } from '../types';

interface ScreenAuthDriverProps {
  onLoginSuccess: (account: DriverAccount) => void;
}

export const ScreenAuthDriver: React.FC<ScreenAuthDriverProps> = ({ onLoginSuccess }) => {
  // Campos de Login Único (sem criar conta)
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Modais de Informações Legais / Rodapé
  const [activeModal, setActiveModal] = useState<'privacy' | 'terms' | 'support' | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginIdentifier.trim()) {
      setErrorMessage('Informe seu telefone ou usuário.');
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
      const account = await api.loginDriver(loginIdentifier, loginPassword);
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
            Acesse seu painel com seu usuário ou telefone cadastrado para receber entregas e vincular-se às lojas.
          </p>
        </header>

        {/* Formulário Principal de Login */}
        <div className="nwl-card">
          <form onSubmit={handleLogin} className="nwl-form">
            <div>
              <label htmlFor="nwl-login-identifier" className="nwl-label">
                <Phone size={16} color="#F8F5FC" />
                Telefone ou Usuário
              </label>
              <div className="nwl-field">
                <input
                  id="nwl-login-identifier"
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="(11) 98765-4321 ou Nome"
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
                  <span>Entrar no Aplicativo</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        </div>

        <div className="nwl-secure">
          <ShieldCheck size={26} color="#D97BB9" style={{ flexShrink: 0 }} />
          <span>Conexão criptografada de ponta a ponta vinculada à Central NovaesWeb.</span>
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
    </div>
  );
};

export default ScreenAuthDriver;
