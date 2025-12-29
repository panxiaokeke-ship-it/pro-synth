
export type WaveformType = 'sine' | 'square' | 'sawtooth' | 'triangle';
export type Language = 'en' | 'zh';
export type LoopMode = 'repeat' | 'oneshot' | 'pingpong';

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
  masterTune: number;
  glide: boolean;
  glideSpeed: number;
}

export interface MIDIMapping {
  [ccNumber: number]: string; // ccNumber -> path (e.g., 'filter.frequency')
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
  mode: LoopMode;
}

export interface StoredPreset {
  id: string;
  name: string;
  settings: SynthSettings;
  timestamp: number;
}
