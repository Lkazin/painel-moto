import { useEffect, useState } from 'react';
import { startupSound } from '../services/startupSound';
import { getAnimatedNotices, setAnimatedNotices, subscribeNotices } from '../services/inAppNotices';

export function ExperienceSettings() {
  const [sound, setSound] = useState(startupSound.getEnabled);
  const [animated, setAnimated] = useState(getAnimatedNotices);
  useEffect(() => {
    const stopSound = startupSound.subscribe(() => setSound(startupSound.getEnabled()));
    const stopNotices = subscribeNotices(() => setAnimated(getAnimatedNotices()));
    return () => { stopSound(); stopNotices(); };
  }, []);
  return <section className="card-surface" aria-label="Abertura e avisos" style={{ padding: 16, display: 'grid', gap: 14 }}>
    <h3 style={{ fontSize: 16 }}>Abertura e avisos</h3>
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
      <span>Som de abertura <small style={{ display: 'block', color: 'var(--text-muted)' }}>{sound ? 'Ativado' : 'Desativado'}</small></span>
      <input type="checkbox" checked={sound} onChange={event => startupSound.setEnabled(event.target.checked)} />
    </label>
    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Som discreto de motor na próxima abertura. O aparelho pode bloquear a reprodução automática. Os sons de novos pedidos continuam independentes.</p>
    <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 44 }}>
      <span>Notificações animadas <small style={{ display: 'block', color: 'var(--text-muted)' }}>{animated ? 'Ativadas' : 'Desativadas'}</small></span>
      <input type="checkbox" checked={animated} onChange={event => setAnimatedNotices(event.target.checked)} />
    </label>
    <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>Controla a animação dos avisos dentro do app. Pedidos, notificações push e seus sons continuam ativos conforme as configurações existentes.</p>
  </section>;
}
