
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type Language = 'en' | 'zh';

export interface EnvelopeSettings {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface FilterSettings {
  frequency: number;
  resonance: number;
  type: BiquadFilterType;
}

export interface SynthSettings {
  waveform: WaveformType;
  envelope: EnvelopeSettings;
  filter: FilterSettings;
  detune: number;
  gain: number;
  reverb: number;
  delay: number;
  stereoWidth: number;
}

export interface NoteEvent {
  note: string;
  frequency: number;
  startTime: number;
  duration?: number;
  timestamp: number;
}

export interface RecordedLoop {
  id: string;
  name: string;
  events: NoteEvent[];
  duration: number;
}

export interface StoredPreset {
  id: string;
  name: string;
  settings: SynthSettings;
  timestamp: number;
}
