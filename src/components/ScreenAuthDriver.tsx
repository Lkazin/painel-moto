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
  X
} from 'lucide-react';
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
    <div
      style={{
        padding: '24px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '22px',
        maxWidth: '440px',
        margin: '0 auto',
        minHeight: '100vh',
        justifyContent: 'space-between'
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingTop: '12px' }}>
          <div
            style={{
              width: '80px',
              height: '80px',
              borderRadius: '24px',
              background: 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 30px rgba(236, 72, 153, 0.45)',
              marginBottom: '6px'
            }}
          >
            <Bike size={46} color="#ffffff" strokeWidth={2.4} />
          </div>

          <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px', marginTop: '4px' }}>
            NovaesWeb <span style={{ color: 'var(--nw-pink)' }}>Entregador</span>
          </h1>

          <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.4 }}>
            Acesse seu painel com seu usuário ou telefone cadastrado para receber entregas e vincular-se às lojas.
          </p>
        </div>

        {/* Formulário Principal de Login */}
        <div className="card-surface card-highlight" style={{ padding: '24px' }}>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c084fc', marginBottom: '6px', textTransform: 'uppercase' }}>
                Telefone ou Usuário
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={loginIdentifier}
                  onChange={(e) => {
                    setLoginIdentifier(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="(11) 98765-4321 ou Nome"
                  autoFocus
                  style={{
                    width: '100%',
                    height: '56px',
                    padding: '0 16px 0 46px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '14px',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
                <Phone size={20} color="var(--nw-purple)" style={{ position: 'absolute', left: '16px', top: '18px' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c084fc', marginBottom: '6px', textTransform: 'uppercase' }}>
                Senha de Acesso
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => {
                    setLoginPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  style={{
                    width: '100%',
                    height: '56px',
                    padding: '0 48px 0 46px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '14px',
                    color: '#ffffff',
                    fontSize: '18px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
                <Lock size={20} color="var(--nw-purple)" style={{ position: 'absolute', left: '16px', top: '18px' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '16px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
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
              style={{ marginTop: '6px', height: '60px', fontSize: '16px' }}
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

        <div style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12px', lineHeight: 1.5 }}>
          🔒 Conexão criptografada de ponta a ponta vinculada à Central NovaesWeb.
        </div>
      </div>

      {/* RODAPÉ OFICIAL NOVAESWEB */}
      <footer
        style={{
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: '20px',
          marginTop: '24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px',
          textAlign: 'center'
        }}
      >
        {/* Links Rápidos: Política de Privacidade, Termos e Ajuda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => setActiveModal('privacy')}
            style={{
              background: 'none',
              border: 'none',
              color: '#c084fc',
              fontSize: '12px',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Shield size={14} />
            Política de Privacidade
          </button>

          <span style={{ color: 'var(--border-subtle)', fontSize: '12px' }}>•</span>

          <button
            type="button"
            onClick={() => setActiveModal('terms')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <FileText size={14} />
            Termos de Uso
          </button>

          <span style={{ color: 'var(--border-subtle)', fontSize: '12px' }}>•</span>

          <button
            type="button"
            onClick={() => setActiveModal('support')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <HelpCircle size={14} />
            Ajuda / Suporte
          </button>
        </div>

        {/* Informações da Plataforma */}
        <div style={{ fontSize: '11px', color: 'var(--text-subtle)', lineHeight: 1.6 }}>
          <p style={{ margin: 0, fontWeight: 700, color: 'var(--text-muted)' }}>
            NovaesWeb Tecnologia & Logística Integrada
          </p>
          <p style={{ margin: 0 }}>
            Todos os direitos reservados • Versão 2.4.0 (Build Seguro)
          </p>
          <p style={{ margin: '4px 0 0 0', opacity: 0.8 }}>
            CNPJ & Infraestrutura Cloud em conformidade com a LGPD (Lei Nº 13.709/2018)
          </p>
        </div>
      </footer>

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
