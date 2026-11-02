import React, { useEffect, useRef, useState } from 'react';
import { Phone, Lock, ArrowRight, LogIn, AlertCircle, Eye, EyeOff, Shield, FileText, Package, ShieldCheck, Headphones, Smartphone, CheckCircle, ArrowLeft } from 'lucide-react';
import './ScreenAuthDriver.css';
import { api } from '../services/api';
import { audioAlert } from '../utils/audioAlert';
import { DriverAccount, FirstAccessChallenge } from '../types';
import { PWAInstallModal } from './PWAInstallModal';
import { AccountInformationModal } from './AccountInformationModal';

interface ScreenAuthDriverProps { onLoginSuccess: (account: DriverAccount) => void; notice?: string; }
function normalizeFirstAccessCode(value: string) {
  const raw = value.toUpperCase().replace(/[\s-]/g, '').replace(/[^A-Z0-9]/g, '');
  if (raw.length <= 2 && 'AC'.startsWith(raw)) return raw;
  return raw.startsWith('AC') ? 'AC-' + raw.slice(2).replace(/[^A-F0-9]/g, '').slice(0, 12) : raw.slice(0, 14);
}
export const ScreenAuthDriver: React.FC<ScreenAuthDriverProps> = ({onLoginSuccess,notice}) => {
  const [mode,setMode] = useState<'login'|'first-access'>('login');
  const [phone,setPhone] = useState('');
  const [code,setCode] = useState('');
  const [password,setPassword] = useState('');
  const [confirmation,setConfirmation] = useState('');
  const [address,setAddress] = useState('');
  const [vehicleModel,setVehicleModel] = useState('');
  const [plate,setPlate] = useState('');
  const [challenge,setChallenge] = useState<FirstAccessChallenge|null>(null);
  const [showPassword,setShowPassword] = useState(false);
  const [loading,setLoading] = useState(false);
  const [errorMessage,setErrorMessage] = useState<string|null>(null);
  const [activeModal,setActiveModal] = useState<'privacy'|'terms'|'support'|null>(null);
  const [showInstallModal,setShowInstallModal] = useState(false);
  const requestRevision = useRef(0);
  const detailsHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => () => { requestRevision.current++; api.cancelFirstAccess(); },[]);
  useEffect(() => { if(challenge) detailsHeading.current?.focus(); },[challenge]);

  const resetAccess = (nextMode: 'login'|'first-access') => {
    requestRevision.current++; api.cancelFirstAccess();
    setMode(nextMode); setChallenge(null); setCode(''); setPassword(''); setConfirmation('');
    setAddress(''); setVehicleModel(''); setPlate(''); setShowPassword(false); setLoading(false); setErrorMessage(null);
  };
  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const revision = ++requestRevision.current;
    setLoading(true); setErrorMessage(null); audioAlert.playClickSound();
    try {
      if(mode === 'first-access' && !challenge) {
        if(!/^AC-[A-F0-9]{12}$/.test(code)) throw new Error('Informe o código de primeiro acesso AC-XXXXXXXXXXXX fornecido pela loja.');
        const result = await api.startFirstAccess(phone,code);
        if(revision === requestRevision.current) {setChallenge(result);setCode('');}
        return;
      }
      if(!password) throw new Error('Informe sua senha.');
      let account: DriverAccount;
      if(mode === 'first-access' && challenge) {
        if(Date.parse(challenge.expiresAt) <= Date.now()) throw new Error('Esta autorização expirou. Volte para informar um novo código.');
        if(password.length < 8 || password.length > 128) throw new Error('Escolha uma senha de 8 a 128 caracteres.');
        if(password !== confirmation) throw new Error('As senhas precisam ser iguais.');
        if(address.trim().length < 8 || address.trim().length > 500) throw new Error('Informe seu endereço completo, incluindo número, bairro e cidade.');
        if(vehicleModel.trim().length < 2 || vehicleModel.trim().length > 100) throw new Error('Informe o nome ou modelo da sua moto.');
        account = await api.completeFirstAccess({onboardingToken:challenge.onboardingToken,password,address:address.trim(),vehicleModel:vehicleModel.trim(),vehiclePlate:plate.trim().toUpperCase() || undefined});
      } else account = await api.loginDriver(phone,password);
      if(revision !== requestRevision.current) return;
      audioAlert.playSuccessSound(); onLoginSuccess(account);
    } catch(error) {
      if(revision !== requestRevision.current) return;
      audioAlert.playErrorSound(); setErrorMessage(error instanceof Error ? error.message : 'Não foi possível continuar. Tente novamente.');
    } finally {if(revision === requestRevision.current)setLoading(false);}
  };
  return (
    <div className="nwl-root">
      <div className="nwl-bg" aria-hidden="true"/>
      <div className="nwl-content">
        <div className="nwl-main">
          <header className="nwl-header">
            <h1 className="nwl-brand-heading"><img className="nwl-brand-logo" src="/brand/novaesweb-entregador-ui.png" width="480" height="320" alt="NovaesWeb Entregador" fetchPriority="high" decoding="async" /></h1>
            <span className="nwl-badge"><Package size={16} color="#F5B6D7"/>Painel do Entregador</span>
            <p className="nwl-subtitle">Seu cadastro acompanha você. Entre no celular ou no computador com apenas um acesso conectado por vez.</p>
          </header>
          <div className="nwl-card">
            <div className="nwl-account-switch" aria-label="Acesso à conta">
              <button type="button" className="nwl-account-option" aria-pressed={mode === 'login'} onClick={() => resetAccess('login')}>Entrar</button>
              <button type="button" className="nwl-account-option" aria-pressed={mode === 'first-access'} onClick={() => resetAccess('first-access')}>Primeiro acesso</button>
            </div>
            <p className="nwl-account-hint">{mode === 'login' ? 'Já concluiu seu cadastro? Use o mesmo telefone e senha. Seus dados ficam salvos na sua conta.' : challenge ? 'Confira o cadastro da loja e complete seus dados. Você só precisa fazer isso no primeiro acesso.' : 'A loja cadastra seu nome e WhatsApp. Informe esse telefone e o código de primeiro acesso que ela enviou.'}</p>
            {mode === 'first-access' && <ol className="nwl-onboarding-steps" aria-label="Etapas do primeiro acesso"><li aria-current={!challenge ? 'step' : undefined}>1. Conferir acesso</li><li aria-current={challenge ? 'step' : undefined}>2. Completar cadastro</li></ol>}
            {notice && <p className="nwl-error" role="alert">{notice}</p>}
            <form onSubmit={handleSubmit} className="nwl-form" aria-busy={loading}>
              {challenge ? <>
                <section className="nwl-verified-account" aria-labelledby="nwl-details-title">
                  <h2 id="nwl-details-title" ref={detailsHeading} tabIndex={-1}><CheckCircle size={18} aria-hidden="true"/>Cadastro confirmado pela loja</h2>
                  <dl><div><dt>Nome</dt><dd>{challenge.name}</dd></div><div><dt>WhatsApp</dt><dd>{challenge.phone}</dd></div><div><dt>Loja</dt><dd>{challenge.storeName}</dd></div></dl>
                  <p>Esses dados foram informados pela loja e não podem ser alterados nesta etapa.</p>
                </section>
                <div><label htmlFor="nwl-address" className="nwl-label">Seu endereço completo</label><textarea id="nwl-address" className="nwl-input nwl-input--plain nwl-address-input" value={address} onChange={event => setAddress(event.target.value)} autoComplete="street-address" minLength={8} maxLength={500} required disabled={loading} placeholder="Rua, número, complemento, bairro, cidade e estado" aria-describedby="nwl-address-help"/><p id="nwl-address-help" className="nwl-field-help">É o seu endereço de cadastro, não o endereço de entrega do cliente.</p></div>
                <div><label htmlFor="nwl-model" className="nwl-label">Nome ou modelo da moto</label><input id="nwl-model" className="nwl-input nwl-input--plain" value={vehicleModel} onChange={event => setVehicleModel(event.target.value)} minLength={2} maxLength={100} required disabled={loading} placeholder="Ex.: Honda CG 160"/></div>
                <div><label htmlFor="nwl-plate" className="nwl-label">Placa <span className="nwl-optional">opcional</span></label><input id="nwl-plate" className="nwl-input nwl-input--plain" value={plate} onChange={event => setPlate(event.target.value.toUpperCase())} maxLength={12} disabled={loading} autoCapitalize="characters" placeholder="Pode deixar para depois"/></div>
              </> : <>
                <div><label htmlFor="nwl-phone" className="nwl-label"><Phone size={16} aria-hidden="true"/>{mode === 'login' ? 'Telefone com DDD' : 'WhatsApp cadastrado pela loja'}</label><div className="nwl-field"><input id="nwl-phone" className="nwl-input" type="tel" autoComplete={mode === 'login' ? 'username' : 'tel'} value={phone} onChange={event => {setPhone(event.target.value);setErrorMessage(null);}} maxLength={20} required disabled={loading} placeholder="(51) 99999-9999"/><Phone size={20} className="nwl-input-icon" aria-hidden="true"/></div></div>
                {mode === 'first-access' && <div><label htmlFor="nwl-access-code" className="nwl-label">Código de primeiro acesso</label><input id="nwl-access-code" className="nwl-input nwl-input--plain nwl-code-input" value={code} onChange={event => {setCode(normalizeFirstAccessCode(event.target.value));setErrorMessage(null);}} onPaste={event => {event.preventDefault();setCode(normalizeFirstAccessCode(event.clipboardData.getData('text')));setErrorMessage(null);}} autoComplete="off" autoCapitalize="characters" spellCheck={false} placeholder="AC-XXXXXXXXXXXX" pattern="AC-[A-F0-9]{12}" minLength={15} maxLength={15} required disabled={loading} aria-describedby="nwl-access-code-help"/><p id="nwl-access-code-help" className="nwl-field-help">Peça o código AC-... ao lojista. O código de plantão NW-... não é utilizado nesta etapa.</p></div>}
              </>}
              {(mode === 'login' || challenge) && <div><label htmlFor="nwl-password" className="nwl-label"><Lock size={16} aria-hidden="true"/>{challenge ? 'Crie sua senha' : 'Senha'}</label><div className="nwl-field"><input id="nwl-password" className="nwl-input nwl-input--password" type={showPassword ? 'text' : 'password'} value={password} onChange={event => setPassword(event.target.value)} autoComplete={challenge ? 'new-password' : 'current-password'} minLength={challenge ? 8 : undefined} maxLength={128} required disabled={loading}/><Lock size={20} className="nwl-input-icon" aria-hidden="true"/><button type="button" className="nwl-eye-btn" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}>{showPassword ? <EyeOff size={20}/> : <Eye size={20}/>}</button></div></div>}
              {challenge && <div><label htmlFor="nwl-password-confirmation" className="nwl-label">Confirme sua senha</label><input id="nwl-password-confirmation" className="nwl-input nwl-input--plain" type={showPassword ? 'text' : 'password'} value={confirmation} onChange={event => setConfirmation(event.target.value)} autoComplete="new-password" minLength={8} maxLength={128} required disabled={loading}/><p className="nwl-field-help">Use de 8 a 128 caracteres e guarde sua senha. A recuperação automática por telefone ainda não está disponível.</p></div>}
              {errorMessage && <div className="nwl-error" role="alert"><AlertCircle size={20} aria-hidden="true"/><span>{errorMessage}</span></div>}
              <button type="submit" className="nwl-submit" disabled={loading}>{mode === 'login' ? <LogIn size={22}/> : <ArrowRight size={22}/>}<span>{loading ? 'Aguarde...' : mode === 'login' ? 'Entrar no aplicativo' : challenge ? 'Concluir e entrar' : 'Conferir meu acesso'}</span></button>
              {mode === 'first-access' && <button type="button" className="nwl-onboarding-back" onClick={() => resetAccess(challenge ? 'first-access' : 'login')}><ArrowLeft size={17}/>{challenge ? 'Voltar e usar outro código' : 'Já tenho senha. Entrar'}</button>}
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
