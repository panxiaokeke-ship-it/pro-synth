
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SynthSettings, WaveformType, Language } from '../types';
import { TRANSLATIONS } from '../constants';

interface ControlsProps {
  settings: SynthSettings;
  setSettings: React.Dispatch<React.SetStateAction<SynthSettings>>;
  lang: Language;
}

const ControlGroup: React.FC<{ title: string; children: React.ReactNode; className?: string }> = ({ title, children, className = "" }) => (
  <div className={`flex flex-col px-2.5 border-r border-zinc-900/50 last:border-0 ${className}`}>
    <h4 className="text-[5px] uppercase text-zinc-700 font-black mb-1.5 tracking-widest">{title}</h4>
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
  onChange: (val: number) => void;
  size?: number;
}

const Knob: React.FC<KnobProps> = ({ label, value, min, max, step, onChange, size = 34 }) => {
  const [isDragging, setIsDragging] = useState(false);
  const startY = useRef(0);
  const startValue = useRef(0);

  const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
    setIsDragging(true);
    startY.current = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    startValue.current = value;
    document.body.style.cursor = 'ns-resize';
  };

  const onMove = useCallback((clientY: number) => {
    if (!isDragging) return;
    const delta = startY.current - clientY;
    const range = max - min;
    const sensitivity = 0.007; 
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
  const rotation = (normalizedValue * 270) - 135; // Total 270 degrees
  const stroke = 2.5;
  const radius = (size - stroke) / 2;
  const circumference = radius * 2 * Math.PI;
  const arcLength = 0.75 * circumference;
  const offset = (1 - normalizedValue) * arcLength;

  return (
    <div className="flex flex-col items-center select-none">
      <div 
        className="relative cursor-ns-resize touch-none active:scale-105 transition-transform" 
        onMouseDown={onMouseDown}
        onTouchStart={onMouseDown}
      >
        <svg width={size} height={size} className="transform -rotate-[225deg]">
          <circle 
            cx={size/2} cy={size/2} r={radius} fill="transparent" 
            stroke="rgba(39,39,42,0.4)" strokeWidth={stroke} 
            strokeDasharray={`${arcLength} ${circumference}`} 
          />
          <circle 
            cx={size/2} cy={size/2} r={radius} fill="transparent" 
            stroke="#06b6d4" strokeWidth={stroke} 
            strokeDasharray={`${arcLength} ${circumference}`} 
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-[stroke-dashoffset] duration-75"
          />
        </svg>
        <div 
          className="absolute inset-[3px] bg-zinc-900 rounded-full border border-zinc-800 shadow-xl flex items-center justify-center transition-transform duration-75" 
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          <div className="absolute top-0.5 w-0.5 h-1.5 bg-cyan-400 rounded-full shadow-[0_0_5px_rgba(34,211,238,0.9)]" />
        </div>
      </div>
      <div className="mt-1 leading-none flex flex-col items-center">
        <span className="text-[5.5px] font-black text-zinc-700 uppercase tracking-tighter">{label}</span>
        <span className="text-[6.5px] mono text-cyan-500/80 font-black">
          {value >= 1000 ? (value/1000).toFixed(1) + 'k' : value.toFixed(value < 1 ? 2 : 0)}
        </span>
      </div>
    </div>
  );
};

const Controls: React.FC<ControlsProps> = ({ settings, setSettings, lang }) => {
  const updateEnvelope = (key: keyof SynthSettings['envelope'], val: number) => setSettings(p => ({ ...p, envelope: { ...p.envelope, [key]: val } }));
  const updateFilter = (key: keyof SynthSettings['filter'], val: number) => setSettings(p => ({ ...p, filter: { ...p.filter, [key]: val } }));

  return (
    <div className="flex items-end justify-between overflow-x-auto no-scrollbar py-0.5 px-1">
      <div className="flex flex-1 min-w-0">
        <ControlGroup title="OSC">
          <div className="grid grid-cols-2 gap-0.5">
            {(['sine', 'square', 'sawtooth', 'triangle'] as WaveformType[]).map((w) => (
              <button 
                key={w} 
                onClick={() => setSettings(p => ({ ...p, waveform: w }))} 
                className={`w-5 h-4 rounded text-[4.5px] font-black uppercase border transition-all ${settings.waveform === w ? 'bg-cyan-500 text-black border-cyan-400 shadow-[0_0_5px_rgba(6,182,212,0.4)]' : 'bg-black border-zinc-800 text-zinc-700 hover:border-zinc-700'}`}
              >
                {w.slice(0, 3)}
              </button>
            ))}
          </div>
          <Knob label="DT" value={settings.detune} min={-100} max={100} step={1} onChange={(v) => setSettings(p => ({ ...p, detune: v }))} />
          <Knob label="WD" value={settings.stereoWidth} min={0} max={1} step={0.01} onChange={(v) => setSettings(p => ({ ...p, stereoWidth: v }))} />
        </ControlGroup>

        <ControlGroup title="ADSR">
          <Knob label="A" value={settings.envelope.attack} min={0.01} max={2} step={0.01} onChange={(v) => updateEnvelope('attack', v)} />
          <Knob label="D" value={settings.envelope.decay} min={0.01} max={2} step={0.01} onChange={(v) => updateEnvelope('decay', v)} />
          <Knob label="S" value={settings.envelope.sustain} min={0.01} max={1} step={0.01} onChange={(v) => updateEnvelope('sustain', v)} />
          <Knob label="R" value={settings.envelope.release} min={0.01} max={3} step={0.01} onChange={(v) => updateEnvelope('release', v)} />
        </ControlGroup>

        <ControlGroup title="FILT">
          <Knob label="CUT" value={settings.filter.frequency} min={20} max={15000} step={1} onChange={(v) => updateFilter('frequency', v)} />
          <Knob label="RES" value={settings.filter.resonance} min={0.1} max={20} step={0.1} onChange={(v) => updateFilter('resonance', v)} />
        </ControlGroup>

        <ControlGroup title="FX">
          <Knob label="DEL" value={settings.delay} min={0} max={0.8} step={0.01} onChange={(v) => setSettings(p => ({ ...p, delay: v }))} />
          <Knob label="REV" value={settings.reverb} min={0} max={0.8} step={0.01} onChange={(v) => setSettings(p => ({ ...p, reverb: v }))} />
        </ControlGroup>
      </div>

      <ControlGroup title="MAST" className="ml-auto bg-cyan-500/5 px-4 rounded-l-lg border-l border-cyan-500/10">
        <Knob label="VOL" value={settings.gain} min={0} max={1} step={0.01} size={38} onChange={(v) => setSettings(p => ({ ...p, gain: v }))} />
      </ControlGroup>
    </div>
  );
};

export default Controls;
