import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import './DeliveryExperience.css';

interface DeliveryBottomSheetProps {
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}

/** Ações de entrega são sempre botões; arrastar serve somente para fechar o painel. */
export function DeliveryBottomSheet({ title, description, onClose, children }: DeliveryBottomSheetProps) {
  const titleId = useId();
  const descriptionId = useId();
  const panel = useRef<HTMLElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const closeAction = useRef(onClose);
  const dragStart = useRef<number | null>(null);
  const [drag, setDrag] = useState(0);
  useEffect(() => { closeAction.current = onClose; }, [onClose]);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    close.current?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeAction.current(); return; }
      if (event.key !== 'Tab') return;
      const controls = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]') || []).filter(item => item.getClientRects().length);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first) { event.preventDefault(); panel.current?.focus(); }
      else if (event.shiftKey && (document.activeElement === first || !panel.current?.contains(document.activeElement))) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (document.activeElement === last || !panel.current?.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous?.isConnected) previous.focus(); };
  }, []);
  return createPortal(<div className="de-sheet-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined} tabIndex={-1} className="de-sheet" style={{ transform: drag ? `translateY(${drag}px)` : undefined }}>
      <div className="de-sheet-drag" aria-hidden="true"
        onPointerDown={event => { dragStart.current = event.clientY; event.currentTarget.setPointerCapture(event.pointerId); }}
        onPointerMove={event => { if (dragStart.current !== null) setDrag(Math.max(0, event.clientY - dragStart.current)); }}
        onPointerUp={() => { const shouldClose = drag > 90; dragStart.current = null; setDrag(0); if (shouldClose) onClose(); }}
        onPointerCancel={() => { dragStart.current = null; setDrag(0); }}><span /></div>
      <header className="de-sheet-header"><div><h2 id={titleId}>{title}</h2>{description && <p id={descriptionId}>{description}</p>}</div><button ref={close} type="button" className="de-icon-button" onClick={onClose} aria-label="Fechar painel"><X size={22} /></button></header>
      <div className="de-sheet-content">{children}</div>
    </section>
  </div>, document.body);
}
