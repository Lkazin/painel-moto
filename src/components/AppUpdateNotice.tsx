import { useEffect, useRef, useState } from 'react';
import { BellRing, Download, RefreshCw, X } from 'lucide-react';
import { appUpdates, type AndroidRelease, type AppUpdateState } from '../services/appUpdates';
import { updateNotifications } from '../services/updateNotifications';
import { nativeAppUpdater } from '../services/nativeAppUpdater';
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

function useNativeDownload() {
  const [state, setState] = useState(() => nativeAppUpdater.getState());
  useEffect(() => {
    const unsubscribe = nativeAppUpdater.subscribe(setState);
    if (nativeAppUpdater.getState().supported) void nativeAppUpdater.refresh().catch(() => { /* O serviço informa a falha no estado. */ });
    return unsubscribe;
  }, []);
  return state;
}

function DownloadUpdate({ release }: { release: AndroidRelease }) {
  const state = useNativeDownload();
  const [acting, setActing] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);
  const busy = useRef(false);
  useEffect(() => {
    setError(''); setActing(false); busy.current = false;
    return () => { request.current++; };
  }, [release.version, release.build]);
  const matches = state.version === release.version && state.build === release.build;
  const phase = matches ? state.state : 'idle';
  const downloadingOther = !matches && state.state === 'downloading';
  const progress = Number.isFinite(state.progress) && state.progress !== null ? Math.min(100, Math.max(0, state.progress)) : null;
  async function act(install: boolean) {
    if (busy.current) return;
    busy.current = true;
    const revision = ++request.current;
    setActing(true); setError('');
    try {
      if (install) {
        const downloaded = nativeAppUpdater.getState();
        if (downloaded.version !== release.version || downloaded.build !== release.build || !['ready', 'permission'].includes(downloaded.state)) throw new Error('O arquivo disponível mudou. Confira a atualização novamente.');
        await nativeAppUpdater.install();
      } else {
        const available = appUpdates.getState().release;
        if (!available || available.version !== release.version || available.build !== release.build) throw new Error('A versão disponível mudou. Confira a atualização novamente.');
        await nativeAppUpdater.start(available);
      }
    } catch {
      if (revision === request.current) setError(install ? 'Não foi possível abrir a instalação. Confira a permissão do Android e tente novamente.' : 'Não foi possível iniciar o download no aplicativo. Tente novamente.');
    } finally {
      if (revision === request.current) { busy.current = false; setActing(false); }
    }
  }
  if (!state.supported) return <p className="nwa-update-help">O download interno precisa de uma versão Android com esse recurso instalado. Atualize para essa versão para baixar as próximas atualizações no próprio app.</p>;
  const canInstall = phase === 'ready' || phase === 'permission';
  const label = acting ? canInstall ? 'Abrindo confirmação…' : 'Preparando download…'
    : downloadingOther ? 'Outra atualização em andamento'
    : phase === 'downloading' ? 'Baixando no aplicativo…'
    : phase === 'paused' ? 'Retomar download'
    : phase === 'permission' ? 'Autorizar instalação no Android'
    : phase === 'ready' ? 'Instalar atualização'
    : phase === 'failed' ? 'Tentar baixar novamente' : 'Baixar e atualizar';
  return <div className="nwa-native-download">
    {(phase === 'downloading' || phase === 'paused') && <div className="nwa-download-progress">
      <div className="nwa-download-progress-label"><span>{phase === 'paused' ? 'Download pausado' : `Baixando versão ${release.version}`}</span><span aria-hidden="true">{progress === null ? 'Aguarde…' : `${Math.round(progress)}%`}</span></div>
      <div className={`nwa-download-progress-track${progress === null ? ' is-indeterminate' : ''}`} role="progressbar" aria-label={`Download da versão ${release.version}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress === null ? undefined : Math.round(progress)} aria-valuetext={phase === 'paused' ? progress === null ? 'Download pausado' : `Download pausado em ${Math.round(progress)}%` : progress === null ? 'Download em andamento' : `${Math.round(progress)}% baixado`}><span style={{ width: progress === null ? '35%' : `${progress}%` }} /></div>
    </div>}
    {phase === 'ready' && <p className="nwa-download-status" role="status">Download concluído. Toque para abrir a confirmação de instalação do Android.</p>}
    {phase === 'permission' && <p className="nwa-download-status" role="status">Permita que o NovaesWeb Entregador instale esta atualização nas configurações do Android. Depois volte ao app e toque em instalar. O Android ainda pedirá sua confirmação.</p>}
    {matches && state.message && <p className={phase === 'failed' ? 'nwa-update-error' : 'nwa-update-help'} role={phase === 'failed' ? 'alert' : 'status'}>{state.message}</p>}
    {downloadingOther && <p className="nwa-update-help">Outra versão está sendo baixada. O progresso desse arquivo não corresponde à versão {release.version}.</p>}
    <button type="button" className="nwa-update-download" disabled={acting || phase === 'downloading' || downloadingOther} onClick={() => void act(canInstall)}>
      <Download size={18} aria-hidden="true" />{label}
    </button>
    {error && <p className="nwa-update-error" role="alert">{error}</p>}
    <p className="nwa-update-help">Baixa no próprio app, sem abrir navegador. Instale fora de uma entrega; o Android pede sua confirmação para instalar.</p>
  </div>;
}

function briefNotes(notes: string) {
  return notes.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(?:^|\s)#{1,6}\s*/g, ' ').replace(/[*_`]/g, '')
    .replace(/\s+/g, ' ').trim().slice(0, 140);
}

function useNotify() {
  const [state, setState] = useState(() => updateNotifications.getState());
  useEffect(() => {
    const stop = updateNotifications.subscribe(setState);
    void updateNotifications.refresh().catch(() => { /* O serviço publica o erro no estado. */ });
    return stop;
  }, []);
  return state;
}

function CellularUpdateSettings({ automatic }: { automatic: boolean }) {
  const state = useNotify();
  const [actionError, setActionError] = useState('');
  async function enable(enabled: boolean) {
    setActionError('');
    try { await updateNotifications.setEnabled(enabled); }
    catch { setActionError('Não foi possível configurar o aviso. Confira a permissão do Android e tente novamente.'); }
  }
  async function refresh() {
    setActionError('');
    try { await updateNotifications.refresh(); }
    catch { setActionError('Não foi possível conferir a permissão agora. Tente novamente.'); }
  }
  const blocked = state.permission === 'denied' || state.channelEnabled === false;
  const unavailable = !state.supported || state.permission === 'unavailable';
  return <section className="nwa-phone-settings" aria-labelledby="nwa-phone-title">
    <div className="nwa-phone-heading"><BellRing size={19} aria-hidden="true" /><h4 id="nwa-phone-title">Aviso no celular</h4></div>
    <label className="nwa-update-toggle"><span>Notificar sobre novas versões<small>Notificação do Android, além do aviso dentro do app</small></span><input type="checkbox" checked={state.enabled} disabled={state.busy || unavailable} onChange={event => void enable(event.target.checked)} /></label>
    {unavailable ? <p className="nwa-update-help">Este recurso precisa de uma versão Android do aplicativo com o aviso no celular instalado. Versões antigas não recebem esse recurso apenas por abrir o app.</p> : <>
      <p className="nwa-phone-status" role="status">{state.busy ? 'Conferindo aviso no celular…' : !state.enabled ? 'Aviso no celular desativado.' : blocked ? 'Aviso bloqueado nas configurações do Android.' : state.permission === 'prompt' ? 'Falta permitir as notificações no Android.' : state.channelEnabled === null ? 'Permissão concedida. O canal de atualização ainda precisa ser conferido.' : 'Permissão e canal de atualização habilitados.'}</p>
      {state.enabled && state.permission === 'prompt' && <button type="button" className="nwa-update-check" disabled={state.busy} onClick={() => void enable(true)}><BellRing size={17} aria-hidden="true" />Permitir aviso no celular</button>}
      {blocked && <><p className="nwa-update-help">No Android, abra Configurações → Aplicativos → NovaesWeb Entregador → Notificações. Permita as notificações e o canal de atualizações; depois volte aqui para conferir.</p><button type="button" className="nwa-update-check" disabled={state.busy} onClick={() => void refresh()}><RefreshCw size={17} aria-hidden="true" />Verificar permissão</button></>}
      {!automatic && state.enabled && <p className="nwa-update-help nwa-phone-attention">A verificação automática está desligada. Ative “Verificar novas versões automaticamente” acima para receber avisos automáticos.</p>}
      <p className="nwa-update-help">Depois de instalar a versão com este recurso, o Android pode verificar novas versões periodicamente, mesmo com o app fechado. A execução depende do aparelho, da conexão e das restrições de bateria; o aviso pode demorar.</p>
      <p className="nwa-update-help">A consulta usa apenas a versão do aplicativo e as publicações oficiais no GitHub. Não envia dados da sua conta, clientes ou entregas. A instalação sempre exige sua confirmação no Android.</p>
    </>}
    {(state.error || actionError) && <p className="nwa-update-error" role="alert">{actionError || state.error}</p>}
  </section>;
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
    {briefNotes(state.release.notes) && <p className="nwa-update-notes">{briefNotes(state.release.notes)}</p>}
    <p className="nwa-update-help">Conclua suas entregas antes de instalar. O Android pedirá sua confirmação.</p>
    <div className="nwa-update-actions"><DownloadUpdate release={state.release} /><button type="button" className="nwa-update-later" onClick={() => appUpdates.dismiss()}>Agora não</button></div>
  </aside>;
}

export function AppUpdateSettings() {
  const state = useUpdates(false);
  if (!state?.supported) return null;
  return <section className="nwa-update-settings" aria-label="Atualizações do aplicativo">
    <h3>Atualizações do aplicativo</h3>
    <p className="nwa-update-help">Versão instalada: {state.currentVersion || 'verificando…'}</p>
    <label className="nwa-update-toggle"><span>Verificar novas versões automaticamente<small>Consulta periódica, conforme conexão e disponibilidade</small></span><input type="checkbox" checked={state.automatic} onChange={event => appUpdates.setAutomatic(event.target.checked)} /></label>
    <p className="nwa-update-help">O app mostra um aviso quando encontra uma versão nova. Toque em baixar e confirme a instalação no Android.</p>
    <button type="button" className="nwa-update-check" disabled={state.checking} onClick={() => void appUpdates.check(true)}><RefreshCw size={17} aria-hidden="true" />{state.checking ? 'Verificando…' : 'Verificar atualização'}</button>
    {state.release ? <div className="nwa-update-available"><p>Versão {state.release.version} disponível para baixar.</p><DownloadUpdate release={state.release} /><p className="nwa-update-help">Instale fora de uma entrega. Seus dados continuam na sua conta.</p></div>
      : !state.checking && !state.error && state.checkedAt && <p className="nwa-update-help" role="status">Nenhuma atualização publicada disponível para este aplicativo.</p>}
    {state.error && <p className="nwa-update-error" role="status">Não foi possível verificar agora. Tente novamente quando houver conexão.</p>}
    <CellularUpdateSettings automatic={state.automatic} />
  </section>;
}
