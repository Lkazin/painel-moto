import { useEffect, useRef, useState } from 'react';
import { BellRing, CheckCircle2, Info, AlertCircle, X, ChevronRight } from 'lucide-react';
import { dismissNotice, openNotice, startInAppNotices, subscribeNotices, type InAppNoticeState } from '../services/inAppNotices';
import './InAppNotice.css';

export function InAppNotice() {
  const [state, setState] = useState<InAppNoticeState>({ current: null, pendingCount: 0, animated: true });
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const exitTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const unsubscribe = subscribeNotices(setState);
    const stop = startInAppNotices();
    return () => { unsubscribe(); stop(); if (exitTimer.current !== null) clearTimeout(exitTimer.current); };
  }, []);
  const notice = state.current;
  if (!notice) return null;
  const leaving = leavingId === notice.id;
  const dismiss = () => {
    if (leaving) return;
    if (!state.animated || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { dismissNotice(notice.id); return; }
    setLeavingId(notice.id);
    if (exitTimer.current !== null) clearTimeout(exitTimer.current);
    exitTimer.current = setTimeout(() => { dismissNotice(notice.id); setLeavingId(null); exitTimer.current = null; }, 150);
  };
  const Icon = notice.kind === 'offer' ? BellRing : notice.kind === 'success' ? CheckCircle2 : notice.kind === 'error' ? AlertCircle : Info;
  return <aside className={`nw-notice-host ${state.animated ? 'nw-notice-animated' : 'nw-notice-simple'}`} aria-label="Aviso do aplicativo">
    <div className={`nw-notice${leaving ? ' nw-notice-leaving' : ''}`} key={notice.id}>
      <div className="nw-notice-content" role="status" aria-live="polite" aria-atomic="true">
        <span className="nw-notice-icon" aria-hidden="true"><Icon size={21} /></span>
        <div className="nw-notice-copy"><strong>{notice.title}</strong><p>{notice.message}</p></div>
      </div>
      <div className="nw-notice-actions">
        {notice.onOpen && <button type="button" disabled={leaving} className="nw-notice-open" onClick={() => openNotice(notice.id)}>Ver {notice.kind === 'offer' ? 'entrega' : 'detalhes'}<ChevronRight size={16} aria-hidden="true" /></button>}
        {state.pendingCount > 0 && <button type="button" disabled={leaving} className="nw-notice-next" onClick={dismiss}>Próximo aviso ({state.pendingCount})</button>}
        <button type="button" disabled={leaving} className="nw-notice-close" aria-label="Dispensar aviso" onClick={dismiss}><X size={18} aria-hidden="true" /></button>
      </div>
    </div>
  </aside>;
}
