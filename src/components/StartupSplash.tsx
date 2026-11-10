import './StartupSplash.css';

interface StartupSplashProps {
  /** The parent keeps this screen mounted while the existing session check finishes. */
  loading?: boolean;
}

/** Presentation only: session routing, timing and optional audio belong to the app. */
export function StartupSplash({ loading = false }: StartupSplashProps) {
  return (
    <section className={`nw-startup${loading ? ' nw-startup--loading' : ''}`} aria-label="Abertura NovaesWeb Entregador" aria-busy={loading}>
      <div className="nw-startup__glow" aria-hidden="true" />
      <div className="nw-startup__content">
        <img className="nw-startup__logo" src="/brand/novaesweb-entregador-ui.png" alt="" width="472" height="312" fetchPriority="high" />
        <h1 className="nw-startup__name">NovaesWeb <span>Entregador</span></h1>
        <p className="nw-startup__tagline">Sua próxima entrega começa aqui.</p>
      </div>

      <div className="nw-startup__road" aria-hidden="true">
        <div className="nw-startup__road-line" />
        <div className="nw-startup__vehicle">
          <svg viewBox="0 0 220 130" fill="none" className="nw-startup__motorcycle">
            {/* Decorative delivery motorcycle; the official logo above remains unchanged. */}
            <path className="nw-startup__speed" d="M2 68H38M11 81H33M4 94H25" stroke="#ff79c6" strokeWidth="3" strokeLinecap="round" />
            <ellipse cx="123" cy="119" rx="79" ry="5" fill="#030108" opacity=".5" />
            <g className="nw-startup__wheel nw-startup__wheel--rear">
              <circle cx="72" cy="100" r="21" fill="#100c1b" stroke="#e9d8ff" strokeWidth="5" />
              <path d="M72 84V116M56 100H88M61 89L83 111M61 111L83 89" stroke="#8e59c9" strokeWidth="2" />
              <circle cx="72" cy="100" r="5" fill="#ff2e9a" />
            </g>
            <g className="nw-startup__wheel nw-startup__wheel--front">
              <circle cx="177" cy="100" r="21" fill="#100c1b" stroke="#e9d8ff" strokeWidth="5" />
              <path d="M177 84V116M161 100H193M166 89L188 111M166 111L188 89" stroke="#8e59c9" strokeWidth="2" />
              <circle cx="177" cy="100" r="5" fill="#ff2e9a" />
            </g>
            <path d="M72 100L104 70H142L121 100H72Z" fill="#a32be7" stroke="#f8dafa" strokeWidth="3" strokeLinejoin="round" />
            <path d="M144 62L177 100M144 62L158 58H168" stroke="#f8dafa" strokeWidth="5" strokeLinecap="round" />
            <path d="M149 76C166 68 184 76 191 87" stroke="#ff2e9a" strokeWidth="7" strokeLinecap="round" />
            <path d="M72 77H105L119 84H140L146 72L129 60H110L98 68H72Z" fill="#ff2e9a" />
            <path d="M90 65H119" stroke="#fff3fc" strokeWidth="6" strokeLinecap="round" />
            <rect x="40" y="35" width="43" height="38" rx="7" fill="#8e2de2" stroke="#f1d8ff" strokeWidth="2" />
            <path d="M43 47H80M61 37V70" stroke="#c789f5" strokeWidth="2" />
            <path d="M120 42L104 61L123 76L116 89" stroke="#f8f5ff" strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M121 43L140 59H155" stroke="#f8f5ff" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M112 33C112 19 122 12 133 15C145 18 146 32 142 39H117Z" fill="#ff2e9a" stroke="#f5ddff" strokeWidth="2" />
            <path d="M127 24H144L142 33H128Z" fill="#251139" />
            <path d="M66 82L53 86" stroke="#ff6478" strokeWidth="5" strokeLinecap="round" />
            <path d="M176 68L184 72" stroke="#fff4be" strokeWidth="5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      <div className="nw-startup__status" role="status" aria-live="polite">
        <span className="nw-startup__indicator" aria-hidden="true" />
        <span>{loading ? 'Verificando seu acesso…' : 'Preparando sua próxima entrega…'}</span>
      </div>
    </section>
  );
}
