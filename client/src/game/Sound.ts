/** Kurze Soundeffekte per WebAudio-Synthese, ohne Audiodateien. */
export class Sound {
  private ctx: AudioContext | null = null;
  enabled = true;

  private context(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private tone(freq: number, duration: number, type: OscillatorType, volume: number, delay = 0, slide = 0): void {
    const ctx = this.context();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
  }

  private noise(duration: number, volume: number, filter: number): void {
    const ctx = this.context();
    if (!ctx) return;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const biquad = ctx.createBiquadFilter();
    biquad.type = 'lowpass';
    biquad.frequency.value = filter;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(biquad).connect(gain).connect(ctx.destination);
    src.start();
  }

  dig(): void {
    this.noise(0.18, 0.35, 900);
  }
  rock(): void {
    this.noise(0.25, 0.4, 2500);
    this.tone(160, 0.15, 'square', 0.05, 0, -80);
  }
  pickup(): void {
    this.tone(520, 0.08, 'triangle', 0.12);
    this.tone(780, 0.1, 'triangle', 0.12, 0.07);
  }
  lay(): void {
    this.tone(880, 0.06, 'sine', 0.1);
  }
  shaft(): void {
    this.tone(220, 0.12, 'square', 0.06);
    this.tone(330, 0.12, 'square', 0.06, 0.1);
  }
  reject(): void {
    this.tone(180, 0.18, 'sawtooth', 0.06, 0, -60);
  }
  ability(): void {
    this.tone(600, 0.25, 'sine', 0.1, 0, 600);
  }
  online(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.22, 'triangle', 0.13, i * 0.09));
  }
  win(): void {
    [523, 659, 784, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.25, 'triangle', 0.12, i * 0.12));
  }
  lose(): void {
    [392, 330, 262].forEach((f, i) => this.tone(f, 0.3, 'triangle', 0.1, i * 0.18));
  }
}
