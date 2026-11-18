import { HarmonicScale } from './clockEngine';

class ClockAudioSynth {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.22;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  public unlock() {
    this.ensureContext();
  }

  public triggerTick(
    level: 'second' | 'minute' | 'hour',
    audibleBaseHz: number,
    scale: HarmonicScale
  ) {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();

    let freq = audibleBaseHz;
    let duration = 0.055;
    let peak = 0.28;

    if (scale === 'pentatonic') {
      if (level === 'second') {
        freq = audibleBaseHz * 1.5;
        duration = 0.05;
        peak = 0.16;
      } else if (level === 'minute') {
        freq = audibleBaseHz * 2.0;
        duration = 0.14;
        peak = 0.3;
      } else {
        freq = audibleBaseHz * 2.5;
        duration = 0.45;
        peak = 0.45;
      }
      osc.type = 'sine';
    } else if (scale === 'quartz') {
      if (level === 'second') {
        freq = 1760;
        duration = 0.025;
        peak = 0.14;
        osc.type = 'triangle';
      } else if (level === 'minute') {
        freq = 880;
        duration = 0.11;
        peak = 0.26;
        osc.type = 'sine';
      } else {
        freq = 587.33;
        duration = 0.38;
        peak = 0.4;
        osc.type = 'sine';
      }
    } else {
      // Schumann harmonic tuning
      const base = 250.56; // 7.83 Hz * 32
      if (level === 'second') {
        freq = base;
        duration = 0.07;
        peak = 0.16;
      } else if (level === 'minute') {
        freq = base * 1.5;
        duration = 0.2;
        peak = 0.3;
      } else {
        freq = base * 2;
        duration = 0.55;
        peak = 0.45;
      }
      osc.type = 'sine';
    }

    osc.frequency.setValueAtTime(freq, now);
    env.gain.setValueAtTime(0.0001, now);
    env.gain.exponentialRampToValueAtTime(peak, now + 0.004);
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(env);
    env.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

export const clockAudioSynth = new ClockAudioSynth();
