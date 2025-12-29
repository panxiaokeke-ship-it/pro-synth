
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SynthSettings, WaveformType, Language, MIDIMapping } from '../types';
import { TRANSLATIONS } from '../constants';
import { Zap, Link as LinkIcon } from 'lucide-react';

interface ControlsProps {
  settings: SynthSettings;
  setSettings: React.Dispatch<React.SetStateAction<SynthSettings>>;
  lang: Language;
  isLearnMode?: boolean;
  learningParam?: string | null;
  setLearningParam?: (id: string | null) => void;
  midiMappings?: MIDIMapping;
}

const ControlGroup: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
  <div className={`flex flex-col px-3 border-r border-zinc-900/40 last:border-0 ${className}`}>
    <h4 className="text-[6px] uppercase text-zinc-700 font-black mb-1.5 tracking-tighter">{title}</h4>
    <div className="flex items-center gap-2">
      {children}
    </div>
  </div>
);

interface KnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (val: number) => void;
  size?: number;
  // MIDI Learn Props
  paramId?: string;
  isLearnMode?: boolean;
  isCurrentLearning?: boolean;
  setLearningParam?: (id: string | null) => void;
  mappedCC?: string | null;
}

export const Knob: React.FC<KnobProps> = ({ 
  label, value, min, max, step, unit = "", onChange, size = 32,
  paramId, isLearnMode, isCurrentLearning, setLearningParam, mappedCC
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    if (isLearnMode && setLearningParam && paramId) {
      setLearningParam(isCurrentLearning ? null : paramId);
      return;
    }
    setIsDragging(true);
    startY.current = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    startValue.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const onMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = startY.current - clientY;
    const range = max - min;
    const sensitivity = 0.006; 
    let newValue = startValue.current + (delta * range * sensitivity);
    newValue = Math.max(min, Math.min(max, newValue));
    onChange(Math.round(newValue / step) * step);
  }, [isDragging, min, max, step, onChange]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => onMove(e.clientY);
    const handleTouchMove = (e: TouchEvent) => onMove(e.touches[0].clientY);
    const handleEnd = () => {
      setIsDragging(false);
      document.body.style.cursor = 'default';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, onMove]);

  const normalizedValue = (value - min) / (max - min);
  const rotation = (normalizedValue * 270) - 135;
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const arcLength = 0.75 * circumference;
  const offset = (1 - normalizedValue) * arcLength;

  return (
    <div className={`flex flex-col items-center select-none group relative ${isLearnMode ? 'cursor-help' : ''}`}>
      <div 
        className="relative cursor-ns-resize touch-none" 
        onMouseDown={onMouseDown}
        onTouchStart={onMouseDown}
      >
        <svg width={size} height={size} className="transform -rotate-[225deg]">
          <circle 
            cx={size/2} cy={size/2} r={radius} fill="transparent" 
            stroke="rgba(39,39,42,1)" strokeWidth={stroke} 
            strokeDasharray={`${arcLength} ${circumference}`} 
          />
          <circle 
            cx={size/2} cy={size/2} r={radius} fill="transparent" 
            stroke={isLearnMode ? (isCurrentLearning ? '#f59e0b' : '#71717a') : '#06b6d4'} 
            strokeWidth={stroke} 
            strokeDasharray={`${arcLength} ${circumference}`} 
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset,stroke] duration-150 ease-out"
          />
        </svg>
        <div 
          className={`absolute inset-[3px] rounded-full border shadow-lg flex items-center justify-center transition-all duration-150 ${isLearnMode ? (isCurrentLearning ? 'bg-amber-950 border-amber-500 animate-pulse' : 'bg-zinc-950 border-zinc-800 opacity-60') : 'bg-zinc-900 border-zinc-800'}`} 
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className={`absolute top-0.5 w-0.5 h-1.5 rounded-full ${isLearnMode ? (isCurrentLearning ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,1)]' : 'bg-zinc-700') : 'bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.8)]'}`} />
        </div>

        {/* Learn Mode Overlay */}
        {isLearnMode && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {isCurrentLearning ? (
              <Zap size={size * 0.4} className="text-amber-500" />
            ) : mappedCC ? (
              <LinkIcon size={size * 0.4} className="text-amber-500/80" />
            ) : null}
          </div>
        )}
      </div>
      <div className="mt-1 leading-none flex flex-col items-center">
        <span className={`text-[6px] font-bold uppercase tracking-tighter transition-colors ${isCurrentLearning ? 'text-amber-500' : 'text-zinc-600'}`}>{label}</span>
        <span className={`text-[7px] mono font-black transition-colors ${isCurrentLearning ? 'text-amber-400' : 'text-cyan-500/80'}`}>{value >= 1000 ? (value/1000).toFixed(1) + 'k' : value.toFixed(value < 1 ? 2 : 0)}</span>
      </div>
      
      {/* Small CC Label if mapped */}
      {isLearnMode && mappedCC && (
        <div className="absolute -top-1 -right-1 bg-amber-600 text-black text-[5px] font-black px-1 rounded-sm scale-75 border border-amber-400">
          CC{mappedCC}
        </div>
      )}
    </div>
  );
};

const Controls: React.FC<ControlsProps> = ({ 
  settings, setSettings, lang, isLearnMode, learningParam, setLearningParam, midiMappings 
}) => {
  const updateEnvelope = (key: keyof SynthSettings['envelope'], val: number) => setSettings(p => ({ ...p, envelope: { ...p.envelope, [key]: val } }));
  const updateFilter = (key: keyof SynthSettings['filter'], val: number) => setSettings(p => ({ ...p, filter: { ...p.filter, [key]: val } }));

  const getMappedCC = (id: string) => {
    if (!midiMappings) return null;
    return Object.entries(midiMappings).find(([_, path]) => path === id)?.[0] || null;
  };

  const commonProps = (id: string) => ({
    paramId: id,
    isLearnMode,
    isCurrentLearning: learningParam === id,
    setLearningParam,
    mappedCC: getMappedCC(id)
  });

  return (
    <div className="flex items-end justify-between overflow-x-auto no-scrollbar py-1">
      <div className="flex">
        <ControlGroup title="OSC">
          <div className="flex flex-col gap-0.5">
            {(['sine', 'square', 'sawtooth', 'triangle'] as WaveformType[]).map((w) => (
              <button key={w} onClick={() => setSettings(p => ({ ...p, waveform: w }))} className={`w-6 py-0.5 rounded text-[5px] font-black uppercase border ${settings.waveform === w ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_5px_rgba(6,182,212,0.4)]' : 'bg-black border-zinc-800 text-zinc-700'}`}>
                {w.slice(0, 3)}
              </button>
            ))}
          </div>
          <Knob label="DT" value={settings.detune} min={-100} max={100} step={1} onChange={(v) => setSettings(p => ({ ...p, detune: v }))} {...commonProps('detune')} />
          <Knob label="WD" value={settings.stereoWidth} min={0} max={1} step={0.01} onChange={(v) => setSettings(p => ({ ...p, stereoWidth: v }))} {...commonProps('stereoWidth')} />
        </ControlGroup>

        <ControlGroup title="ADSR">
          <Knob label="A" value={settings.envelope.attack} min={0.01} max={2} step={0.01} onChange={(v) => updateEnvelope('attack', v)} {...commonProps('envelope.attack')} />
          <Knob label="D" value={settings.envelope.decay} min={0.01} max={2} step={0.01} onChange={(v) => updateEnvelope('decay', v)} {...commonProps('envelope.decay')} />
          <Knob label="S" value={settings.envelope.sustain} min={0.01} max={1} step={0.01} onChange={(v) => updateEnvelope('sustain', v)} {...commonProps('envelope.sustain')} />
          <Knob label="R" value={settings.envelope.release} min={0.01} max={3} step={0.01} onChange={(v) => updateEnvelope('release', v)} {...commonProps('envelope.release')} />
        </ControlGroup>

        <ControlGroup title="FILTER">
          <Knob label="CUT" value={settings.filter.frequency} min={20} max={15000} step={1} onChange={(v) => updateFilter('frequency', v)} {...commonProps('filter.frequency')} />
          <Knob label="RES" value={settings.filter.resonance} min={0.1} max={20} step={0.1} onChange={(v) => updateFilter('resonance', v)} {...commonProps('filter.resonance')} />
        </ControlGroup>

        <ControlGroup title="FX">
          <Knob label="DEL" value={settings.delay} min={0} max={0.8} step={0.01} onChange={(v) => setSettings(p => ({ ...p, delay: v }))} {...commonProps('delay')} />
          <Knob label="REV" value={settings.reverb} min={0} max={0.8} step={0.01} onChange={(v) => setSettings(p => ({ ...p, reverb: v }))} {...commonProps('reverb')} />
          <div className="flex flex-col items-center gap-1.5 px-2 border-l border-zinc-800/30 ml-1">
             <span className="text-[5px] font-black text-zinc-600 uppercase">Glide</span>
             <button 
              onClick={() => setSettings(p => ({ ...p, glide: !p.glide }))} 
              className={`w-7 h-3.5 rounded-full relative transition-all duration-200 ${settings.glide ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.4)]' : 'bg-zinc-800'}`}
             >
                <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white transition-all duration-200 ${settings.glide ? 'left-[16px]' : 'left-0.5'}`} />
             </button>
             <Knob label="SPD" value={settings.glideSpeed} min={0.01} max={1} step={0.01} size={24} onChange={(v) => setSettings(p => ({ ...p, glideSpeed: v }))} {...commonProps('glideSpeed')} />
          </div>
        </ControlGroup>
      </div>

      <ControlGroup title="MASTER" className="ml-auto bg-cyan-500/5 px-4 rounded-l-lg border-l border-cyan-500/10">
        <Knob label="VOL" value={settings.gain} min={0} max={1} step={0.01} size={40} onChange={(v) => setSettings(p => ({ ...p, gain: v }))} {...commonProps('gain')} />
      </ControlGroup>
    </div>
  );
};

export default Controls;
