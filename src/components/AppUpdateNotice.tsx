import { useEffect, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { appUpdates, type AppUpdateState } from '../services/appUpdates';
import './AppUpdateNotice.css';

function useUpdates(start: boolean) {
  const [state, setState] = useState<AppUpdateState | null>(null);
  useEffect(() => {
    const unsubscribe = appUpdates.subscribe(setState);
    const stop = start ? appUpdates.start() : () => {};
    return () => { unsubscribe(); stop(); };
  }, [start]);
  return state;
}

function DownloadUpdate() {
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState('');
  async function download() {
    if (opening) return;
    setOpening(true); setError('');
    try { await appUpdates.openDownload(); }
    catch { setError('Não foi possível abrir o download. Tente novamente.'); }
    finally { setOpening(false); }
  }
  return <>
    <button type="button" className="nwa-update-download" disabled={opening} onClick={() => void download()}>
      <Download size={18} aria-hidden="true" />{opening ? 'Abrindo download…' : 'Baixar e atualizar'}
    </button>
    {error && <p className="nwa-update-error" role="alert">{error}</p>}
  </>;
}

/** Mounted outside account/shift branches so the update is available before login too. */
export function AppUpdateNotice() {
  const state = useUpdates(true);
  if (!state?.supported || !state.release || state.dismissed) return null;
  return <aside className="nwa-update-banner" aria-label="Atualização do aplicativo" role="status">
    <div className="nwa-update-heading">
      <div><strong>Nova versão disponível</strong><p>NovaesWeb Entregador {state.release.version}</p></div>
      <button type="button" aria-label="Lembrar da atualização depois" className="nwa-update-close" onClick={() => appUpdates.dismiss()}><X size={20} aria-hidden="true" /></button>
    </div>
    <p className="nwa-update-help">O Android pedirá sua confirmação para instalar. Conclua suas entregas antes da instalação.</p>
    <div className="nwa-update-actions"><DownloadUpdate /><button type="button" className="nwa-update-later" onClick={() => appUpdates.dismiss()}>Agora não</button></div>
  </aside>;
}

export function AppUpdateSettings() {
  const state = useUpdates(false);
  if (!state?.supported) return null;
  return <section className="nwa-update-settings" aria-label="Atualizações do aplicativo">
    <h3>Atualizações do aplicativo</h3>
    <p className="nwa-update-help">Versão instalada: {state.currentVersion || 'verificando…'}</p>
    <button type="button" className="nwa-update-check" disabled={state.checking} onClick={() => void appUpdates.check(true)}><RefreshCw size={17} aria-hidden="true" />{state.checking ? 'Verificando…' : 'Verificar atualização'}</button>
    {state.release ? <div className="nwa-update-available"><p>Versão {state.release.version} disponível para baixar.</p><DownloadUpdate /><p className="nwa-update-help">Instale fora de uma entrega. Seus dados continuam na sua conta.</p></div>
      : !state.checking && !state.error && state.checkedAt && <p className="nwa-update-help" role="status">Nenhuma atualização publicada disponível para este aplicativo.</p>}
    {state.error && <p className="nwa-update-error" role="status">Não foi possível verificar agora. Tente novamente quando houver conexão.</p>}
  </section>;
}
