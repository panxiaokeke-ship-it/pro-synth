
import { SynthSettings, WaveformType } from '../types';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private filter: BiquadFilterNode | null = null;
  private reverb: ConvolverNode | null = null;
  private delay: DelayNode | null = null;
  private delayGain: GainNode | null = null;
  private analyzer: AnalyserNode | null = null;
  private activeNotes: Map<string, { osc: OscillatorNode; gain: GainNode; panner: StereoPannerNode }> = new Map();
  private lastFrequency: number | null = null;

  constructor() {}

  public init() {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    this.analyzer = this.ctx.createAnalyser();
    this.analyzer.fftSize = 2048;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.5;

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 2000;

    this.delay = this.ctx.createDelay(1.0);
    this.delay.delayTime.value = 0.3;
    this.delayGain = this.ctx.createGain();
    this.delayGain.gain.value = 0.2;

    this.filter.connect(this.masterGain);
    this.masterGain.connect(this.analyzer);
    this.analyzer.connect(this.ctx.destination);

    this.masterGain.connect(this.delay);
    this.delay.connect(this.delayGain);
    this.delayGain.connect(this.masterGain);
  }

  public updateSettings(settings: SynthSettings) {
    if (!this.ctx || !this.filter || !this.masterGain || !this.delayGain || !this.delay) return;

    this.filter.frequency.setTargetAtTime(settings.filter.frequency, this.ctx.currentTime, 0.05);
    this.filter.Q.setTargetAtTime(settings.filter.resonance, this.ctx.currentTime, 0.05);
    this.masterGain.gain.setTargetAtTime(settings.gain, this.ctx.currentTime, 0.05);
    this.delayGain.gain.setTargetAtTime(settings.delay, this.ctx.currentTime, 0.05);
    
    this.activeNotes.forEach((note) => {
        const freq = note.osc.frequency.value;
        const panValue = this.calculatePan(freq, settings.stereoWidth);
        note.panner.pan.setTargetAtTime(panValue, this.ctx!.currentTime, 0.1);
        note.osc.detune.setTargetAtTime(settings.detune + (settings.masterTune || 0), this.ctx!.currentTime, 0.05);
    });
  }

  private calculatePan(freq: number, stereoWidth: number): number {
    const normalized = (Math.log2(freq) - Math.log2(130)) / (Math.log2(523) - Math.log2(130));
    return (normalized * 2 - 1) * stereoWidth;
  }

  public playNote(freq: number, label: string, settings: SynthSettings) {
    if (!this.ctx || !this.filter) this.init();
    if (!this.ctx || !this.filter) return;

    if (this.activeNotes.has(label)) {
      this.stopNote(label, settings);
    }

    const osc = this.ctx.createOscillator();
    const noteGain = this.ctx.createGain();
    const panner = this.ctx.createStereoPanner();

    osc.type = settings.waveform;
    
    const now = this.ctx.currentTime;
    
    // Optimized Glide / Portamento Implementation
    if (settings.glide && this.lastFrequency && this.lastFrequency > 0 && this.lastFrequency !== freq && settings.glideSpeed > 0) {
      // Use a small safety buffer for time to ensure precision in the Web Audio scheduling
      const startTime = now + 0.002; 
      const duration = Math.max(settings.glideSpeed, 0.005); // Enforce 5ms min to prevent sharp transients/pops
      
      osc.frequency.setValueAtTime(this.lastFrequency, now);
      osc.frequency.setValueAtTime(this.lastFrequency, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq, startTime + duration);
    } else {
      osc.frequency.setValueAtTime(freq, now);
    }
    
    // Update tracking for the next note's glide start point
    this.lastFrequency = freq;
    
    osc.detune.setValueAtTime(settings.detune + (settings.masterTune || 0), this.ctx.currentTime);
    
    panner.pan.value = this.calculatePan(freq, settings.stereoWidth);

    noteGain.gain.setValueAtTime(0, now);
    noteGain.gain.linearRampToValueAtTime(1, now + settings.envelope.attack);
    noteGain.gain.exponentialRampToValueAtTime(
      Math.max(settings.envelope.sustain, 0.001), 
      now + settings.envelope.attack + settings.envelope.decay
    );

    osc.connect(noteGain);
    noteGain.connect(panner);
    panner.connect(this.filter);

    osc.start();
    this.activeNotes.set(label, { osc, gain: noteGain, panner });
  }

  public stopNote(label: string, settings: SynthSettings) {
    const note = this.activeNotes.get(label);
    if (!note || !this.ctx) return;

    const { osc, gain, panner } = note;
    const now = this.ctx.currentTime;

    gain.gain.cancelScheduledValues(now);
    gain.gain.setValueAtTime(gain.gain.value, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + settings.envelope.release);

    setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
        panner.disconnect();
      } catch (e) {}
    }, settings.envelope.release * 1000 + 100);

    this.activeNotes.delete(label);
  }

  public getAnalyzer() { return this.analyzer; }
  public getContext() { return this.ctx; }
}

export const audioEngine = new AudioEngine();
