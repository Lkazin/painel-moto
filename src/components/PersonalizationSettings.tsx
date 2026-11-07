import { useState } from 'react';
import { Sun, Type, Check, RotateCcw, Vibrate, Eye } from 'lucide-react';
import { hapticFeedback, useExperiencePreferences, type ExperiencePreferences } from '../services/experiencePreferences';

export function PersonalizationSettings() {
  const { preferences, updatePreferences } = useExperiencePreferences();
  const [draft, setDraft] = useState<ExperiencePreferences>(preferences);
  const [message, setMessage] = useState('A prévia abaixo muda antes de salvar.');
  const change = (changes: Partial<ExperiencePreferences>) => { setDraft(previous => ({ ...previous, ...changes })); setMessage('Prévia atualizada. Salve para aplicar no app.'); };
  const dirty = JSON.stringify(draft) !== JSON.stringify(preferences);
  return <section className="card-surface nw-personalization" aria-labelledby="personalization-heading">
    <div className="nw-section-heading"><Eye size={20} aria-hidden="true" /><div><h3 id="personalization-heading">Do seu jeito</h3><p>Experimente uma leitura mais confortável.</p></div></div>
    <div className="nw-settings-grid">
      <label>Tema<select aria-label="Tema" value={draft.theme} onChange={event => change({ theme: event.target.value as ExperiencePreferences['theme'] })}>
        <option value="dark">Escuro NovaesWeb</option><option value="light">Claro</option><option value="system">Acompanhar aparelho</option>
      </select></label>
      <label>Tamanho do texto<select aria-label="Tamanho do texto" value={draft.textScale} onChange={event => change({ textScale: event.target.value as ExperiencePreferences['textScale'] })}>
        <option value="normal">Padrão</option><option value="large">Ampliado</option>
      </select></label>
    </div>
    <label className="nw-setting-switch"><span><Sun size={18} aria-hidden="true" />Leitura na rua<small>Mais contraste e botões maiores.</small></span><input type="checkbox" checked={draft.outdoor} onChange={event => change({ outdoor: event.target.checked })} /></label>
    <label className="nw-setting-switch"><span>Iniciar entregas em modo foco<small>Endereço e ações essenciais primeiro.</small></span><input type="checkbox" checked={draft.focus} onChange={event => change({ focus: event.target.checked })} /></label>
    <label className="nw-setting-switch"><span>Reduzir movimento<small>Transições e números sem animação.</small></span><input type="checkbox" checked={draft.reducedMotion} onChange={event => change({ reducedMotion: event.target.checked })} /></label>
    <label className="nw-setting-switch"><span><Vibrate size={18} aria-hidden="true" />Resposta ao toque<small>Vibrações curtas, se o aparelho permitir.</small></span><input type="checkbox" checked={draft.haptics} onChange={event => change({ haptics: event.target.checked })} /></label>
    <div className="nw-pref-preview" data-theme={draft.theme === 'system' ? (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : draft.theme} data-text-scale={draft.textScale} data-outdoor={String(draft.outdoor)} aria-label="Prévia da aparência, dados ilustrativos">
      <span className="nw-eyebrow">PRÉVIA · EXEMPLO</span><h4><Type size={18} aria-hidden="true" /> Próxima entrega</h4><strong>Rua de exemplo, 120</strong><p>Complemento e referência em destaque.</p><span className="nw-preview-action">{draft.focus ? 'Continuar entrega em foco' : 'Ver detalhes da entrega'}</span>
    </div>
    <div className="nw-settings-actions"><button type="button" data-no-haptic className="btn-glove btn-glove-accent" disabled={!dirty} onClick={() => { updatePreferences(draft); setMessage('Preferências salvas neste aparelho.'); if (draft.haptics) hapticFeedback('success'); }}><Check size={18} />Salvar aparência</button>
    <button type="button" className="btn-glove btn-glove-secondary" disabled={!dirty} onClick={() => { setDraft(preferences); setMessage('Prévia descartada.'); }}><RotateCcw size={18} />Descartar</button></div>
    <p className="nw-settings-feedback" role="status">{message}</p>
  </section>;
}
