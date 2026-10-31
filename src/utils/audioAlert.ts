// Sintetizador de áudio nativo usando Web Audio API + Vibração Tátil
// Otimizado para entregadores na rua: volume alto, padrão sonoro de corrida contínuo e vibração

class AudioAlertManager {
  private ctx: AudioContext | null = null;
  private isAlertRunning = false;
  private alertIntervalId: any = null;
  private isMuted = false;

  private getContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public init(): void {
    const ctx = this.getContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    if (this.isMuted && this.isAlertRunning) {
      this.stopOfferAlert();
    }
    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  // Toca um toque estridente e chamativo (toque tipo sirene de entrega iFood/Rappi com volume alto)
  public playOfferChime(): void {
    if (this.isMuted) return;

    // Disparar vibração no celular do motoboy (se suportado pelo navegador)
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate([400, 150, 400, 150, 700]);
      } catch {}
    }

    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Master Gain em volume alto (0.85)
      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(0.85, now);
      masterGain.connect(ctx.destination);

      // Bipe 1: Tom inicial rápido e cortante (987Hz - B5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sawtooth'; // Onda dente de serra para cortar ruídos de trânsito
      osc1.frequency.setValueAtTime(987.77, now);
      gain1.gain.setValueAtTime(0.7, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.18);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.18);

      // Bipe 2: Tom mais alto (1318Hz - E6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'square'; // Onda quadrada para presença e punch
      osc2.frequency.setValueAtTime(1318.51, now + 0.12);
      gain2.gain.setValueAtTime(0.75, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.32);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.32);

      // Bipe 3: Sirene ascendente potente (1480Hz até 1975Hz - B6)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sawtooth';
      osc3.frequency.setValueAtTime(1479.98, now + 0.28);
      osc3.frequency.exponentialRampToValueAtTime(1975.53, now + 0.55);
      gain3.gain.setValueAtTime(0.85, now + 0.28);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc3.connect(gain3);
      gain3.connect(masterGain);
      osc3.start(now + 0.28);
      osc3.stop(now + 0.65);

      // Bipe 4: Toque de eco final agudo (2093Hz - C7)
      const osc4 = ctx.createOscillator();
      const gain4 = ctx.createGain();
      osc4.type = 'sine';
      osc4.frequency.setValueAtTime(2093.00, now + 0.55);
      gain4.gain.setValueAtTime(0.7, now + 0.55);
      gain4.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
      osc4.connect(gain4);
      gain4.connect(masterGain);
      osc4.start(now + 0.55);
      osc4.stop(now + 0.85);

    } catch (e) {
      console.warn('Erro ao tocar som potente de oferta:', e);
    }
  }

  // Inicia o loop de alerta contínuo que repete a cada 1.4s até o motoboy atender
  public startOfferAlert(): void {
    if (this.isAlertRunning) return;
    this.isAlertRunning = true;
    this.init();
    this.playOfferChime();

    this.alertIntervalId = setInterval(() => {
      if (!this.isAlertRunning) return;
      this.playOfferChime();
    }, 1400);
  }

  // Interrompe imediatamente o alerta de oferta e para a vibração
  public stopOfferAlert(): void {
    this.isAlertRunning = false;
    if (this.alertIntervalId) {
      clearInterval(this.alertIntervalId);
      this.alertIntervalId = null;
    }
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {}
    }
  }

  // Som de clique nos botões grandes (feedback tátil)
  public playClickSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(560, now);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.06);
    } catch {}
  }

  // Som de sucesso (PIN correto / Retirada confirmada)
  public playSuccessSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(659.25, now); // E5
      osc.frequency.exponentialRampToValueAtTime(1318.5, now + 0.22); // E6
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.45);
    } catch {}
  }

  // Som de erro (PIN incorreto / Expirado)
  public playErrorSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.linearRampToValueAtTime(130, now + 0.3);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    } catch {}
  }
}

export const audioAlert = new AudioAlertManager();
