// Sintetizador de áudio nativo usando Web Audio API
// Funciona 100% offline e sem arquivos de áudio externos

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

  // Toca um bipe duplo de alta frequência (notificação de nova oferta)
  public playOfferChime(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Primeiro tom (880Hz - A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.25, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Segundo tom mais agudo (1318.5Hz - E6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1318.5, now + 0.12);
      gain2.gain.setValueAtTime(0.3, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);

      // Terceiro tom de confirmação (1760Hz - A6)
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.type = 'sine';
      osc3.frequency.setValueAtTime(1760, now + 0.26);
      gain3.gain.setValueAtTime(0.35, now + 0.26);
      gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.start(now + 0.26);
      osc3.stop(now + 0.65);
    } catch (e) {
      console.warn('Erro ao tocar som de oferta:', e);
    }
  }

  // Inicia o loop de alerta que repete a cada 2.5s até ser atendido
  public startOfferAlert(): void {
    if (this.isAlertRunning) return;
    this.isAlertRunning = true;
    this.playOfferChime();

    this.alertIntervalId = setInterval(() => {
      if (!this.isAlertRunning) return;
      this.playOfferChime();
    }, 2400);
  }

  // Interrompe imediatamente o alerta de oferta
  public stopOfferAlert(): void {
    this.isAlertRunning = false;
    if (this.alertIntervalId) {
      clearInterval(this.alertIntervalId);
      this.alertIntervalId = null;
    }
  }

  // Som de toque nos botões grandes (feedback para uso com luva)
  public playClickSound(): void {
    if (this.isMuted) return;
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, now);
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.05);
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
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18); // C6
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
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
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.linearRampToValueAtTime(140, now + 0.25);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }
}

export const audioAlert = new AudioAlertManager();
