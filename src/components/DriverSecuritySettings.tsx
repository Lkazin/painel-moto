import { useEffect, useState } from 'react';
import { Fingerprint, ShieldCheck } from 'lucide-react';
import { accountClient } from '../services/accountClient';
import { nativeSecureAccess } from '../services/driverSecurity';

type BiometricState = { available: boolean; enabled: boolean; hasAccount: boolean };
export function DriverSecuritySettings() {
  const [state, setState] = useState<BiometricState | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    if (nativeSecureAccess()) {
      void accountClient.biometricStatus().then(setState).catch(() => setMessage('Não foi possível consultar a biometria deste aparelho.'));
    }
  }, []);
  async function toggle() {
    if (!state || busy) return;
    setBusy(true); setMessage('');
    try {
      const next = await accountClient.configureBiometric(!state.enabled);
      setState(next);
      setMessage(next.enabled ? 'Proteção ativada! Após ficar fora do app, desbloqueie com digital ou rosto.' : 'Biometria desativada. Sua senha continua protegendo a conta.');
    } catch {
      setMessage('Biometria não confirmada. Nenhuma configuração foi alterada.');
    } finally { setBusy(false); }
  }
  return <section className="card-surface" aria-label="Segurança do acesso" style={{ padding: 16, display: 'grid', gap: 12 }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <ShieldCheck size={22} color="var(--nw-emerald)" />
      <h3 style={{ fontSize: 16, fontWeight: 800 }}>Segurança do acesso</h3>
    </div>
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
      <div>
        <strong style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}><Fingerprint size={17} /> Digital ou reconhecimento facial</strong>
        <small style={{ display: 'block', color: 'var(--text-muted)', marginTop: 5 }}>
          {!nativeSecureAccess()
            ? 'Disponível no aplicativo Android; no navegador use telefone e senha.'
            : !state ? 'Verificando a biometria do aparelho...'
            : !state.available ? 'Este aparelho não possui biometria forte cadastrada e compatível.'
            : state.enabled ? 'Ativada. Escolha sua digital ou rosto nas configurações do Android.'
            : 'Opcional. Ative para proteger o acesso ao retornar ao aplicativo.'}
        </small>
      </div>
      {nativeSecureAccess() && <button type="button" onClick={() => void toggle()}
        disabled={busy || !state?.available || !state?.hasAccount}
        style={{ minWidth: 100, padding: '10px 12px', borderRadius: 10, background: state?.enabled ? 'var(--bg-elevated)' : 'var(--nw-purple)', border: '1px solid var(--border-subtle)', color: 'white', fontWeight: 800 }}>
        {busy ? 'Aguarde...' : state?.enabled ? 'Desativar' : 'Ativar'}
      </button>}
    </div>
    <p style={{ color: 'var(--text-muted)', fontSize: 12 }}>
      A digital e o rosto não são enviados à NovaesWeb. O Android verifica a identidade no próprio aparelho.
      A senha continua disponível se você trocar de celular ou não puder usar biometria.
    </p>
    {message && <p role="status" style={{ fontSize: 12, color: 'var(--nw-amber)' }}>{message}</p>}
  </section>;
}
