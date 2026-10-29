import React, { useState } from 'react';
import {
  User,
  Phone,
  Lock,
  Bike,
  CreditCard,
  ArrowRight,
  UserPlus,
  LogIn,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverAccount } from '../types';

interface ScreenAuthDriverProps {
  onLoginSuccess: (account: DriverAccount) => void;
}

export const ScreenAuthDriver: React.FC<ScreenAuthDriverProps> = ({ onLoginSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');

  // Campos de Login
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Campos de Cadastro
  const [regName, setRegName] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPlate, setRegPlate] = useState('');
  const [regModel, setRegModel] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Formatação amigável de telefone brasileiro
  const formatPhone = (val: string) => {
    let digits = val.replace(/\D/g, '');
    if (digits.length > 11) digits = digits.slice(0, 11);
    if (digits.length > 10) {
      return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
    } else if (digits.length > 6) {
      return digits.replace(/^(\d{2})(\d{4})(\d{0,4})$/, '($1) $2-$3');
    } else if (digits.length > 2) {
      return digits.replace(/^(\d{2})(\d{0,5})$/, '($1) $2');
    }
    return digits;
  };

  const formatPlate = (val: string) => {
    return val.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  };

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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName.trim() || regName.trim().length < 3) {
      setErrorMessage('Informe seu nome completo.');
      audioAlert.playErrorSound();
      return;
    }
    if (regPhone.replace(/\D/g, '').length < 10) {
      setErrorMessage('Informe um WhatsApp/celular válido com DDD.');
      audioAlert.playErrorSound();
      return;
    }
    if (!regPlate.trim() || regPlate.trim().length < 5) {
      setErrorMessage('Informe a placa da sua moto/veículo (ex: BRA-2E19).');
      audioAlert.playErrorSound();
      return;
    }
    if (!regPassword || regPassword.length < 4) {
      setErrorMessage('Crie uma senha de no mínimo 4 dígitos.');
      audioAlert.playErrorSound();
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    audioAlert.playClickSound();

    try {
      const account = await api.registerDriver(
        regName,
        regPhone,
        regPlate,
        regModel || 'Moto Padrão',
        regPassword
      );
      audioAlert.playSuccessSound();
      onLoginSuccess(account);
    } catch (err: any) {
      audioAlert.playErrorSound();
      setErrorMessage(err.message || 'Erro ao criar conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        minHeight: '92vh',
        justifyContent: 'center',
        maxWidth: '460px',
        margin: '0 auto'
      }}
    >
      {/* Brand Hero */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 8px 30px var(--nw-pink-glow)'
          }}
        >
          <Bike size={44} color="#ffffff" strokeWidth={2.4} />
        </div>

        <h1 style={{ fontSize: '26px', fontWeight: 900, letterSpacing: '-0.5px', marginTop: '4px' }}>
          NovaesWeb <span style={{ color: 'var(--nw-pink)' }}>Entregador</span>
        </h1>

        <p style={{ fontSize: '13px', color: 'var(--text-muted)', maxWidth: '340px', lineHeight: 1.4 }}>
          Sua conta universal de entregador. Acesse com seus dados pessoais e conecte-se a qualquer pizzaria ou loja parceira.
        </p>
      </div>

      {/* Seletor de Modo (Entrar vs Criar Conta) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '6px',
          background: 'var(--bg-card)',
          padding: '5px',
          borderRadius: '16px',
          border: '1px solid var(--border-subtle)'
        }}
      >
        <button
          type="button"
          onClick={() => {
            audioAlert.playClickSound();
            setAuthMode('login');
            setErrorMessage(null);
          }}
          style={{
            height: '48px',
            borderRadius: '12px',
            border: 'none',
            background: authMode === 'login' ? 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))' : 'transparent',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: authMode === 'login' ? '0 4px 15px rgba(236,72,153,0.35)' : 'none'
          }}
        >
          <LogIn size={18} />
          <span>Já Tenho Conta</span>
        </button>

        <button
          type="button"
          onClick={() => {
            audioAlert.playClickSound();
            setAuthMode('register');
            setErrorMessage(null);
          }}
          style={{
            height: '48px',
            borderRadius: '12px',
            border: 'none',
            background: authMode === 'register' ? 'linear-gradient(135deg, var(--nw-pink), var(--nw-purple))' : 'transparent',
            color: '#ffffff',
            fontWeight: 800,
            fontSize: '14px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            transition: 'all 0.2s ease',
            boxShadow: authMode === 'register' ? '0 4px 15px rgba(236,72,153,0.35)' : 'none'
          }}
        >
          <UserPlus size={18} />
          <span>Criar Conta</span>
        </button>
      </div>

      {/* Formulário Principal */}
      <div className="card-surface card-highlight" style={{ padding: '22px' }}>
        {authMode === 'login' ? (
          /* FLUXO DE LOGIN */
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 800, color: '#c084fc', marginBottom: '6px', textTransform: 'uppercase' }}>
                Seu Telefone ou Usuário
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
                Sua Senha
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
              style={{ marginTop: '6px', height: '62px', fontSize: '16px' }}
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
        ) : (
          /* FLUXO DE CADASTRO */
          <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase' }}>
                Nome Completo
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="text"
                  value={regName}
                  onChange={(e) => {
                    setRegName(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Ex: Carlos Alberto Santos"
                  autoFocus
                  style={{
                    width: '100%',
                    height: '52px',
                    padding: '0 14px 0 42px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
                <User size={18} color="var(--nw-purple)" style={{ position: 'absolute', left: '14px', top: '17px' }} />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase' }}>
                Celular / WhatsApp (com DDD)
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type="tel"
                  value={regPhone}
                  onChange={(e) => {
                    setRegPhone(formatPhone(e.target.value));
                    setErrorMessage(null);
                  }}
                  placeholder="(11) 98765-4321"
                  maxLength={15}
                  style={{
                    width: '100%',
                    height: '52px',
                    padding: '0 14px 0 42px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '15px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
                <Phone size={18} color="var(--nw-purple)" style={{ position: 'absolute', left: '14px', top: '17px' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Placa do Veículo
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={regPlate}
                    onChange={(e) => {
                      setRegPlate(formatPlate(e.target.value));
                      setErrorMessage(null);
                    }}
                    placeholder="BRA-2E19"
                    maxLength={8}
                    style={{
                      width: '100%',
                      height: '52px',
                      padding: '0 10px 0 38px',
                      background: 'var(--bg-app)',
                      border: '1.5px solid var(--border-subtle)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 800,
                      outline: 'none',
                      textTransform: 'uppercase'
                    }}
                  />
                  <CreditCard size={16} color="var(--nw-purple)" style={{ position: 'absolute', left: '12px', top: '18px' }} />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase' }}>
                  Modelo (Opcional)
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={regModel}
                    onChange={(e) => setRegModel(e.target.value)}
                    placeholder="Ex: CG 160"
                    style={{
                      width: '100%',
                      height: '52px',
                      padding: '0 10px 0 38px',
                      background: 'var(--bg-app)',
                      border: '1.5px solid var(--border-subtle)',
                      borderRadius: '12px',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                  <Bike size={16} color="var(--nw-purple)" style={{ position: 'absolute', left: '12px', top: '18px' }} />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#c084fc', marginBottom: '4px', textTransform: 'uppercase' }}>
                Crie sua Senha de Acesso
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => {
                    setRegPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Mínimo 4 dígitos"
                  style={{
                    width: '100%',
                    height: '52px',
                    padding: '0 44px 0 42px',
                    background: 'var(--bg-app)',
                    border: '1.5px solid var(--border-subtle)',
                    borderRadius: '12px',
                    color: '#ffffff',
                    fontSize: '16px',
                    fontWeight: 700,
                    outline: 'none'
                  }}
                />
                <Lock size={18} color="var(--nw-purple)" style={{ position: 'absolute', left: '14px', top: '17px' }} />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    top: '15px',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid var(--nw-red)',
                  borderRadius: '12px',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#fca5a5',
                  fontSize: '12px',
                  fontWeight: 600
                }}
              >
                <AlertCircle size={18} color="var(--nw-red)" style={{ flexShrink: 0 }} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-glove btn-glove-accent"
              style={{ marginTop: '4px', height: '62px', fontSize: '16px' }}
            >
              {loading ? (
                <span>Criando sua conta...</span>
              ) : (
                <>
                  <ShieldCheck size={22} />
                  <span>Cadastrar e Começar</span>
                  <ArrowRight size={20} />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <div style={{ textAlign: 'center', color: 'var(--text-subtle)', fontSize: '12px', lineHeight: 1.5 }}>
        🔒 Seus dados ficam protegidos no seu aparelho e vinculados à Central de Logística NovaesWeb.
      </div>
    </div>
  );
};

export default ScreenAuthDriver;
