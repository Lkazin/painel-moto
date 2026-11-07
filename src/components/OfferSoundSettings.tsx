import { useState } from 'react';
import { audioAlert, type OfferSound } from '../utils/audioAlert';

export function OfferSoundSettings() {
  const [chosen, setChosen] = useState<OfferSound>(() => audioAlert.getOfferSound());
  const [vibration, setVibration] = useState<boolean>(() => audioAlert.getVibrationEnabled());
  const [feedback, setFeedback] = useState('');
  const [saved, setSaved] = useState(() => ({ sound: audioAlert.getOfferSound(), vibration: audioAlert.getVibrationEnabled() }));
  const dirty = chosen !== saved.sound || vibration !== saved.vibration;
  const options: {id: OfferSound; title: string; subtitle: string}[] = [
    {id: 'classic', title: '1. Clássico', subtitle: 'Sirene original'},
    {id: 'soft', title: '2. Suave', subtitle: 'Dois toques discretos'},
    {id: 'tech', title: '3. Tecnológico', subtitle: 'Pulsos digitais futuristas'},
  ];
  return (
    <section className="card-surface" aria-label="Som e vibração dos pedidos" style={{ padding: 16, display: 'grid', gap: 14 }}>
      <h3 style={{ fontSize: 16, fontWeight: 900 }}>Som e vibração de novos pedidos</h3>
      
      <div>
        <label htmlFor="driver-offer-sound" style={{ display: 'block', fontSize: 13, marginBottom: 6 }}>
          Escolha o toque de oferta
        </label>
        <select
          id="driver-offer-sound"
          value={chosen}
          onChange={event => {
            const sound = event.target.value as OfferSound;
            setChosen(sound);
            setFeedback('Toque escolhido para a prévia. Teste e salve quando estiver pronto.');
          }}
          style={{
            minHeight: 48,
            padding: '8px 12px',
            borderRadius: 12,
            color: 'var(--text-primary)',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            width: '100%',
            fontSize: 14,
            fontWeight: 700
          }}
        >
          {options.map(option => (
            <option key={option.id} value={option.id}>
              {option.title} — {option.subtitle}
            </option>
          ))}
        </select>
      </div>

      <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, cursor: 'pointer' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 800 }}>Vibração de chamada</span>
          <small style={{ display: 'block', color: 'var(--text-muted)', fontSize: 12 }}>
            {vibration ? 'Ativada • celular vibra nas ofertas' : 'Desativada • apenas som'}
          </small>
        </div>
        <input
          type="checkbox"
          checked={vibration}
          onChange={event => {
            const enabled = event.target.checked;
            setVibration(enabled);
            setFeedback('Vibração alterada na prévia. Salve para aplicar.');
          }}
          style={{ width: 22, height: 22, accentColor: 'var(--nw-pink)' }}
        />
      </label>

      <button
        type="button"
        data-no-haptic
        className="btn-glove btn-glove-secondary"
        onClick={() => {
          setFeedback(audioAlert.previewOfferSound(chosen, vibration) ? 'Prévia solicitada. Confira o volume de mídia. Som e vibração dependem do suporte e das permissões do aparelho.' : 'Som silenciado: ative o áudio antes de testar.');
        }}
        style={{ minHeight: 50, fontSize: 14 }}
      >
        ▶ Testar som {vibration ? 'e vibração' : ''}
      </button>

      <div className="nw-settings-actions">
        <button type="button" className="btn-glove btn-glove-accent" disabled={!dirty} onClick={() => {
          audioAlert.setOfferSound(chosen); audioAlert.setVibrationEnabled(vibration);
          setSaved({ sound: chosen, vibration }); setFeedback('Som e vibração salvos neste aparelho.');
        }}>Salvar som e vibração</button>
        <button type="button" className="btn-glove btn-glove-secondary" disabled={!dirty} onClick={() => {
          setChosen(saved.sound); setVibration(saved.vibration); setFeedback('Prévia descartada.');
        }}>Descartar</button>
      </div>

      <p role="status" style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        {feedback || 'A escolha fica salva neste aparelho. Com o app fechado, o Android pode usar o som do canal de notificações do sistema.'}
      </p>
    </section>
  );
}
