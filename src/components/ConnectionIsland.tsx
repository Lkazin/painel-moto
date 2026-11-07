import { useEffect, useId, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, MapPin, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import { api } from '../services/api';
import { trackingService } from '../services/trackingService';
import { trackingPresentation } from '../services/trackingPresentation';
import { supportsBackgroundTracking } from '../services/nativeTracking';
import { offlineQueue } from '../services/offlineQueue';
import './ConnectionIsland.css';

export function ConnectionIsland({ online }: { online: boolean }) {
  const panelId = useId();
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState(() => trackingService.getState());
  const [permission, setPermission] = useState(trackingService.getPermissionStatus());
  const [queue, setQueue] = useState(offlineQueue.getQueue());
  const [now, setNow] = useState(Date.now);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');
  const [syncError, setSyncError] = useState('');
  const hadAttention = useRef(false);
  const mounted = useRef(true);
  const syncInFlight = useRef(false);

  useEffect(() => {
    mounted.current = true;
    const stopTracking = trackingService.subscribe(state => {
      setTracking(state);
      setPermission(trackingService.getPermissionStatus());
      setNow(Date.now());
    });
    const stopQueue = offlineQueue.subscribe(setQueue);
    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      setPermission(trackingService.getPermissionStatus());
      setNow(Date.now());
    };
    const timer = setInterval(refresh, 5000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      mounted.current = false;
      stopTracking(); stopQueue(); clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, []);

  const gps = trackingPresentation(tracking, permission, online, now, supportsBackgroundTracking());
  const pending = queue.filter(command => command.status === 'pending' || command.status === 'syncing');
  const failed = queue.filter(command => command.status === 'failed');
  const gpsAttention = gps.kind === 'denied' || (tracking.isActive && ['lost', 'stale'].includes(gps.kind));
  const attention = !online || pending.length > 0 || failed.length > 0 || gpsAttention;
  useEffect(() => {
    // Um mesmo problema não reabre o painel depois de o entregador fechá-lo.
    if (attention && !hadAttention.current) setExpanded(true);
    hadAttention.current = attention;
  }, [attention]);

  async function synchronize() {
    if (syncInFlight.current || !online || pending.length === 0) return;
    syncInFlight.current = true;
    setSyncing(true); setSyncResult(''); setSyncError('');
    try {
      const result = await api.flushOfflineQueue();
      if (!mounted.current) return;
      const remaining = offlineQueue.getQueue().filter(command => command.status === 'pending' || command.status === 'syncing').length;
      setSyncResult(result.syncedCount > 0
        ? `${result.syncedCount} ${result.syncedCount === 1 ? 'ação confirmada' : 'ações confirmadas'} pelo servidor.${remaining > 0 ? ` ${remaining} ainda pendente${remaining === 1 ? '' : 's'}.` : ''}`
        : remaining > 0 ? 'Ainda há ações pendentes. Confira a conexão e o plantão ativo antes de tentar novamente.'
          : 'A verificação terminou. Confira abaixo se alguma ação precisa de revisão.');
      if (result.errors > 0) setSyncError(`${result.errors} ${result.errors === 1 ? 'ação não pôde ser confirmada' : 'ações não puderam ser confirmadas'}. Confira os avisos abaixo.`);
    } catch (error) {
      if (mounted.current) setSyncError(error instanceof Error ? error.message : 'Não foi possível sincronizar. Confira a conexão e tente novamente.');
    } finally {
      syncInFlight.current = false;
      if (mounted.current) setSyncing(false);
    }
  }

  const gpsShort = gps.kind === 'fresh' ? 'GPS confirmado'
    : gps.kind === 'paused' ? 'GPS pausado'
    : gps.kind === 'denied' ? 'GPS sem permissão'
    : gps.kind === 'offline' ? 'Envio GPS pausado'
    : gpsAttention ? 'Revisar GPS' : 'GPS aguardando';
  return <section className={`nw-connection-island${attention ? ' needs-attention' : ''}`} aria-label="Conexão e sincronização">
    <button type="button" className="nw-connection-toggle" aria-expanded={expanded} aria-controls={panelId} onClick={() => setExpanded(value => !value)}>
      <span className="nw-connection-network">{online ? <Wifi size={16} aria-hidden="true" /> : <WifiOff size={16} aria-hidden="true" />}<span>{online ? 'Conectado' : 'Sem internet'}</span></span>
      <span className={`nw-connection-gps${gps.kind === 'fresh' ? ' is-fresh' : ''}`}><MapPin size={14} aria-hidden="true" /><span>{gpsShort}</span></span>
      {failed.length > 0 ? <span className="nw-connection-count">{failed.length} para revisar</span> : pending.length > 0 ? <span className="nw-connection-count">{pending.length} pendente{pending.length === 1 ? '' : 's'}</span> : null}
      <ChevronDown className="nw-connection-chevron" size={17} aria-hidden="true" />
    </button>

    {expanded && <div className="nw-connection-details" id={panelId}>
      <div className="nw-connection-detail-row"><span className={`nw-connection-detail-icon${online ? ' is-ok' : ''}`}>{online ? <Wifi size={18} aria-hidden="true" /> : <WifiOff size={18} aria-hidden="true" />}</span><div><strong>{online ? 'Internet disponível no aparelho' : 'Aparelho sem internet'}</strong><p>{online ? 'A confirmação de cada ação depende da resposta do servidor.' : 'Confira o Wi-Fi ou os dados móveis. As ações pendentes continuam aguardando confirmação.'}</p></div></div>
      <div className="nw-connection-detail-row"><span className={`nw-connection-detail-icon${gps.kind === 'fresh' ? ' is-ok' : ''}`}><MapPin size={18} aria-hidden="true" /></span><div><strong>{gps.label}</strong><p>{gps.detail}</p>{gps.lastSentAt !== null && <small>Último envio confirmado: {new Date(gps.lastSentAt).toLocaleTimeString('pt-BR')}</small>}</div></div>
      <div className="nw-connection-queue">
        <div className="nw-connection-detail-row"><span className={`nw-connection-detail-icon${!pending.length && !failed.length ? ' is-ok' : ''}`}>{pending.length || failed.length ? <RefreshCw size={18} aria-hidden="true" /> : <CheckCircle2 size={18} aria-hidden="true" />}</span><div><strong>{pending.length ? `${pending.length} ${pending.length === 1 ? 'ação aguardando confirmação' : 'ações aguardando confirmação'}` : 'Nenhuma ação aguardando envio'}</strong><p>{pending.length ? 'Uma confirmação guardada no aparelho ainda precisa ser validada pela loja.' : failed.length ? 'Existem ações não confirmadas abaixo. Elas precisam de revisão.' : 'Não há ações pendentes ou falhas nesta fila.'}</p></div></div>
        {pending.length > 0 && <button type="button" className="nw-connection-sync" disabled={!online || syncing} onClick={() => void synchronize()}><RefreshCw size={16} className={syncing ? 'is-spinning' : ''} aria-hidden="true" />{syncing ? 'Verificando com a loja…' : online ? 'Sincronizar agora' : 'Aguardando internet'}</button>}
      </div>
      {failed.length > 0 && <div className="nw-connection-failures"><h3><AlertCircle size={17} aria-hidden="true" />{failed.length} {failed.length === 1 ? 'ação não confirmada' : 'ações não confirmadas'}</h3><p>Estas ações não serão reenviadas automaticamente. Confira o pedido e, se necessário, fale com a loja.</p><ul>{failed.map(command => <li key={command.id}><strong>{({ delivery_confirm: 'Confirmação de entrega', pickup_confirm: 'Confirmação de retirada', route_reorder: 'Alteração da rota', assignment_withdraw: 'Solicitação de desistência' })[command.action]}</strong><span>{command.lastError || 'O servidor não confirmou esta ação. É necessário revisar com a loja.'}</span></li>)}</ul></div>}
      {(syncResult || syncError) && <div className="nw-connection-result" role="status" aria-live="polite">{syncResult && <p>{syncResult}</p>}{syncError && <p className="nw-connection-sync-error">{syncError}</p>}</div>}
    </div>}
  </section>;
}
