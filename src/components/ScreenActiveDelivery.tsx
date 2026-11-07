import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { MapPin, Phone, Navigation, KeyRound, AlertTriangle, ArrowLeft, Clock, Compass, MessageCircle, Focus, ChevronDown, FileText } from 'lucide-react';
import { Assignment } from '../types';
import { audioAlert } from '../utils/audioAlert';
import { useExperiencePreferences } from '../services/experiencePreferences';
import { DeliveryBottomSheet } from './DeliveryExperience';
import './DeliveryExperience.css';

interface ScreenActiveDeliveryProps {
  assignment: Assignment;
  onBack: () => void;
  onOpenPinConfirmation: (assignment: Assignment) => void;
  onRequestWithdraw: (assignment: Assignment) => void;
}

export const ScreenActiveDelivery: React.FC<ScreenActiveDeliveryProps> = ({ assignment, onBack, onOpenPinConfirmation, onRequestWithdraw }) => {
  const { preferences } = useExperiencePreferences();
  const [focusMode, setFocusMode] = useState(preferences.focus);
  const [sheet, setSheet] = useState<'route' | 'contact' | 'details' | null>(null);
  const assignmentKey = assignment.assignmentId || assignment.id || assignment.orderId;
  const storageKey = `nw:gate-wait:${assignmentKey}`;
  const [waitingStartedAt, setWaitingStartedAt] = useState<number | null>(() => {
    if (assignment.waitingGateStartedAt) {
      const parsed = Date.parse(assignment.waitingGateStartedAt);
      if (Number.isFinite(parsed)) return parsed;
    }
    try { const value = Number(localStorage.getItem(storageKey)); return Number.isFinite(value) && value > 0 ? value : null; } catch { return null; }
  });
  const [localExtraMinutes, setLocalExtraMinutes] = useState(0);
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!assignment.waitingGateStartedAt) return;
    const parsed = Date.parse(assignment.waitingGateStartedAt);
    if (Number.isFinite(parsed)) setWaitingStartedAt(previous => !previous || parsed < previous ? parsed : previous);
  }, [assignment.waitingGateStartedAt]);
  useEffect(() => {
    if (!waitingStartedAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [waitingStartedAt]);
  const baseMinutes = assignment.waitingGateLimitMinutes || 5;
  const storeExtraMinutes = assignment.gateWaitExtendedMinutes || 0;
  const totalMinutes = baseMinutes + storeExtraMinutes + localExtraMinutes;
  const totalSeconds = totalMinutes * 60;
  const elapsedSeconds = waitingStartedAt ? Math.max(0, Math.floor((now - waitingStartedAt) / 1000)) : 0;
  const remainingSeconds = Math.max(0, totalSeconds - elapsedSeconds);
  const isExpired = waitingStartedAt !== null && remainingSeconds === 0;
  const isWarning = waitingStartedAt !== null && remainingSeconds > 0 && remainingSeconds <= 60;
  const progressPercent = totalSeconds > 0 ? Math.min(100, (remainingSeconds / totalSeconds) * 100) : 0;
  const formatCountdown = (secs: number) => `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

  const handleStartGateWait = () => {
    audioAlert.playClickSound();
    const timestamp = Date.now();
    setNow(timestamp); setWaitingStartedAt(timestamp);
    try { localStorage.setItem(storageKey, String(timestamp)); } catch { /* O relógio continua em memória. */ }
    void api.setGateWait(assignment.assignmentId || assignment.id || '', new Date(timestamp).toISOString(), baseMinutes);
  };
  const handleExtend3Min = () => { audioAlert.playClickSound(); setLocalExtraMinutes(previous => previous + 3); };
  const fullAddress = [assignment.address, assignment.addressNumber, assignment.neighborhood, assignment.city].filter(Boolean).join(', ');
  const encodedAddress = encodeURIComponent(fullAddress);
  const hasAddress = Boolean(assignment.address?.trim());
  const customerPhone = assignment.customerPhone?.replace(/\D/g, '') || '';
  const whatsappPhone = customerPhone.startsWith('55') && customerPhone.length >= 12 ? customerPhone : `55${customerPhone}`;
  const openWaze = () => { if (!hasAddress) return; audioAlert.playClickSound(); window.open(`https://waze.com/ul?q=${encodedAddress}&navigate=yes`, '_blank', 'noopener,noreferrer'); };
  const openGoogleMaps = () => { if (!hasAddress) return; audioAlert.playClickSound(); window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank', 'noopener,noreferrer'); };
  const callCustomer = () => { if (!customerPhone) return; audioAlert.playClickSound(); window.location.href = `tel:${customerPhone}`; };
  const openWhatsApp = (atGate = false) => {
    if (!customerPhone) return;
    audioAlert.playClickSound();
    const message = atGate
      ? `Olá ${assignment.customerName}! Sou o entregador da ${assignment.storeName || 'loja'} e estou no seu portão/portaria aguardando com o pedido #${assignment.orderNumber}.`
      : `Olá ${assignment.customerName}! Sou o entregador da ${assignment.storeName || 'loja'} e estou com o seu pedido #${assignment.orderNumber} a caminho.`;
    window.open(`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer');
  };
  const openPin = () => { audioAlert.playClickSound(); onOpenPinConfirmation(assignment); };
  const reportProblem = () => { audioAlert.playClickSound(); onRequestWithdraw(assignment); };

  return <div className={`de-screen${focusMode ? ' de-focus' : ''}`}>
    <div className="de-toolbar">
      <button type="button" className="de-back" onClick={onBack}><ArrowLeft size={18} /><span>Minha rota</span></button>
      <button type="button" className="de-focus-toggle" aria-pressed={focusMode} onClick={() => setFocusMode(previous => !previous)}><Focus size={17} /><span>{focusMode ? 'Sair do foco' : 'Modo entrega'}</span></button>
    </div>
    {focusMode && <p className="de-focus-caption" role="status">Foco na próxima parada. Os detalhes continuam disponíveis abaixo.</p>}
    <section className="de-card de-destination" aria-label="Destino da entrega" data-delivery-key={assignmentKey} style={{ viewTransitionName: `delivery-${assignmentKey.replace(/[^a-zA-Z0-9_-]/g, '')}` }}>
      <div className="de-heading"><span className="de-eyebrow">Parada ativa</span><span className="de-order-number">#{assignment.orderNumber || 'Pedido sem número'}</span></div>
      <h1 className="de-customer">{assignment.customerName || 'Cliente não informado'}</h1>
      <div className="de-address"><MapPin size={25} /><div className="de-address-copy">
        <strong>{hasAddress ? [assignment.address, assignment.addressNumber].filter(Boolean).join(', ') : 'Endereço não informado'}</strong>
        {assignment.addressComplement && <p className="de-complement">{assignment.addressComplement}</p>}
        <p>{[assignment.neighborhood, assignment.city].filter(Boolean).join(' · ') || 'Bairro e cidade não informados'}</p>
        {!hasAddress && <p>Confira os dados com a loja antes de iniciar a navegação.</p>}
      </div></div>
      {assignment.instructions && <div className="de-reference"><strong>OBSERVAÇÃO DO CLIENTE</strong><p>{assignment.instructions}</p></div>}
      <details className="de-expand" key={`${assignmentKey}-${focusMode ? 'focus' : 'full'}`}>
        <summary><span>Itens e informações do pedido</span><ChevronDown size={18} /></summary>
        <div className="de-expand-content"><p>{assignment.itemsSummary || 'Itens não informados pela loja. Consulte a loja se precisar conferir o pedido.'}</p></div>
        <button type="button" className="de-link-button" onClick={() => setSheet('details')}><FileText size={16} />Ver todos os detalhes</button>
      </details>
    </section>

    {!focusMode && <div className="de-secondary-actions">
      <button type="button" className="de-link-button" onClick={() => setSheet('route')}><Navigation size={18} />Escolher navegador</button>
      <button type="button" className="de-link-button" onClick={() => setSheet('contact')}><MessageCircle size={18} />Contato do cliente</button>
    </div>}

    <section className={`de-card de-wait${isExpired ? ' de-wait-expired' : isWarning ? ' de-wait-warning' : ''}`} aria-label="Espera no portão">
      <div className="de-wait-heading"><div><h2><Clock size={18} />{waitingStartedAt ? isExpired ? 'Tempo de espera esgotado' : 'Aguardando no portão' : 'Chegou ao endereço?'}</h2><p>{waitingStartedAt ? `Tolerância: ${totalMinutes} min${storeExtraMinutes > 0 ? ` · Loja adicionou ${storeExtraMinutes} min` : ''}` : `Inicie a espera quando chegar · ${baseMinutes} min de tolerância`}</p></div>
        {waitingStartedAt !== null && <span className="de-countdown" aria-label={`${Math.floor(remainingSeconds / 60)} minutos e ${remainingSeconds % 60} segundos restantes`}>{formatCountdown(remainingSeconds)}</span>}
      </div>
      {waitingStartedAt === null ? <button type="button" className="btn-glove btn-glove-warning" onClick={handleStartGateWait}><Clock size={20} />Cheguei no portão · Iniciar espera</button> : <>
        <div className="de-wait-progress" aria-hidden="true"><span style={{ width: `${progressPercent}%` }} /></div>
        {isExpired && <p className="de-warning-copy" role="status">Se o cliente não atender, registre o problema ou entre em contato com a loja. A entrega continua pendente.</p>}
        <div className="de-secondary-actions"><button type="button" className="btn-glove btn-glove-secondary" onClick={handleExtend3Min}>Dar +3 min</button><button type="button" className="btn-glove btn-glove-secondary" onClick={() => openWhatsApp(true)} disabled={!customerPhone}><MessageCircle size={18} />Avisar: no portão</button></div>
        {!customerPhone && <p className="de-empty-info">Telefone não informado. Peça à loja para contatar o cliente.</p>}
      </>}
    </section>
    <button type="button" className="de-link-button de-problem" onClick={reportProblem}><AlertTriangle size={18} />Relatar problema na entrega</button>

    <nav className="de-dock" aria-label="Ações desta entrega">
      <button type="button" onClick={() => setSheet('route')} aria-label="Escolher navegador para esta entrega"><Navigation size={22} /><span>Rota</span></button>
      <button type="button" onClick={() => setSheet('contact')} aria-label="Abrir contato do cliente"><Phone size={21} /><span>Cliente</span></button>
      <button type="button" className="de-dock-confirm" onClick={openPin}><KeyRound size={22} /><span>Confirmar com PIN</span></button>
    </nav>

    {sheet && <DeliveryBottomSheet title={sheet === 'route' ? 'Abrir navegação' : sheet === 'contact' ? 'Falar com o cliente' : 'Detalhes do pedido'} description={`Pedido #${assignment.orderNumber || 'não informado'}`} onClose={() => setSheet(null)}>
      {sheet === 'route' && <><p className="de-empty-info">{hasAddress ? fullAddress : 'Endereço não informado. Confirme com a loja antes de abrir a rota.'}</p><button type="button" onClick={openWaze} className="btn-glove btn-glove-waze" disabled={!hasAddress}><Compass size={22} />Abrir no Waze</button><button type="button" onClick={openGoogleMaps} className="btn-glove btn-glove-maps" disabled={!hasAddress}><Navigation size={22} />Google Maps</button></>}
      {sheet === 'contact' && <>{customerPhone ? <><p className="de-empty-info">{assignment.customerName} · {assignment.customerPhone}</p><button type="button" onClick={() => openWhatsApp()} className="btn-glove btn-glove-secondary"><MessageCircle size={22} />Abrir WhatsApp</button><button type="button" onClick={callCustomer} className="btn-glove btn-glove-secondary"><Phone size={22} />Ligar para o cliente</button><p className="de-empty-info">O WhatsApp abre uma mensagem para você revisar antes de enviar.</p></> : <><p className="de-empty-info">O telefone do cliente não foi informado no pedido. Entre em contato com a loja para conferir os dados.</p><button type="button" className="de-link-button" onClick={() => { setSheet(null); reportProblem(); }}><AlertTriangle size={18} />Registrar problema</button></>}</>}
      {sheet === 'details' && <dl className="de-detail-list"><div><dt>Loja</dt><dd>{assignment.storeName || 'Não informada'}</dd></div><div><dt>Cliente</dt><dd>{assignment.customerName || 'Não informado'}</dd></div><div><dt>Endereço</dt><dd>{hasAddress ? fullAddress : 'Não informado'}</dd></div><div><dt>Complemento</dt><dd>{assignment.addressComplement || 'Não informado'}</dd></div><div><dt>Observações</dt><dd>{assignment.instructions || 'Nenhuma observação informada'}</dd></div><div><dt>Itens</dt><dd>{assignment.itemsSummary || 'Não informados pela loja'}</dd></div><div><dt>Taxa de entrega</dt><dd>{typeof assignment.deliveryFee === 'number' && Number.isFinite(assignment.deliveryFee) ? assignment.deliveryFee.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'Não informada'}</dd></div></dl>}
    </DeliveryBottomSheet>}
  </div>;
};
