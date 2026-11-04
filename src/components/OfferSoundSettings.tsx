import { useState } from 'react';
import { audioAlert, type OfferSound } from '../utils/audioAlert';

export function OfferSoundSettings() {
  const [chosen, setChosen] = useState<OfferSound>(() => audioAlert.getOfferSound());
  const [feedback, setFeedback] = useState('');
  const options: {id: OfferSound; title: string; subtitle: string}[] = [
    {id: 'classic', title: '1. Clássico', subtitle: 'Sirene original'},
    {id: 'soft', title: '2. Suave', subtitle: 'Dois toques discretos'},
    {id: 'tech', title: '3. Tecnológico', subtitle: 'Pulsos digitais futuristas'},
  ];
  return <section className="card-surface" aria-label="Som dos pedidos" style={{ padding: 16, display: 'grid', gap: 12 }}>
    <h3 style={{ fontSize: 16 }}>Som de novos pedidos</h3>
    <label htmlFor="driver-offer-sound" style={{ fontSize: 13 }}>Escolha o toque de oferta</label>
    <select id="driver-offer-sound" value={chosen} onChange={event => {
      const sound = event.target.value as OfferSound;
      audioAlert.setOfferSound(sound);
      setChosen(sound);
      setFeedback('Som salvo neste aparelho.');
    }} style={{ minHeight: 46, padding: '8px 12px', borderRadius: 12, color: 'var(--text-primary)', background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', width: '100%' }}>
      {options.map(option => <option key={option.id} value={option.id}>{option.title} — {option.subtitle}</option>)}
    </select>
    <button type="button" className="btn-glove" onClick={() => {
      setFeedback(audioAlert.testOfferSound() ? 'Prévia reproduzida. Confira o volume de mídia.' : 'Som silenciado: ative o áudio antes de testar.');
    }} style={{ minHeight: 46 }}>▶ Testar som</button>
    <p role="status" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{feedback || 'A escolha fica salva neste aparelho. Vibração e repetição das ofertas permanecem.'}</p>
    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>O teste toca uma vez, sem criar pedidos. Com o app fechado, o Android pode usar o som do canal de notificações do sistema.</p>
  </section>;
}
