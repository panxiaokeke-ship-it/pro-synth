
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { NOTES, KEY_BINDINGS } from '../constants';
import { SynthSettings } from '../types';

interface KeyboardProps {
  onNoteStart: (note: string, freq: number) => void;
  onNoteEnd: (note: string) => void;
  settings: SynthSettings;
}

const Keyboard: React.FC<KeyboardProps> = ({ onNoteStart, onNoteEnd }) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  // pressingKeys is used to trigger the "mechanical" animation class
  const [pressingKeys, setPressingKeys] = useState<Set<string>>(new Set());
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag states
  const [isPanning, setIsPanning] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasMoved = useRef(false);

  const triggerHaptic = useCallback((intensity: number = 8) => {
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(intensity);
    }
  }, []);

  const handleKeyStart = useCallback((noteLabel: string, freq: number) => {
    if (pressedKeysRef.current.has(noteLabel)) return;

    onNoteStart(noteLabel, freq);
    pressedKeysRef.current.add(noteLabel);
    
    // Batch updates for performance
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.add(noteLabel);
      return next;
    });
    
    setPressingKeys(prev => {
      const next = new Set(prev);
      next.add(noteLabel);
      return next;
    });
    
    triggerHaptic(12);

    // After a short duration, we settle from the 'pressing' animation into the steady 'active' state
    setTimeout(() => {
      setPressingKeys(prev => {
        const next = new Set(prev);
        next.delete(noteLabel);
        return next;
      });
    }, 150);
  }, [onNoteStart, triggerHaptic]);

  const handleKeyEnd = useCallback((noteLabel: string) => {
    if (!pressedKeysRef.current.has(noteLabel)) return;

    onNoteEnd(noteLabel);
    pressedKeysRef.current.delete(noteLabel);
    
    setActiveKeys(prev => {
      const next = new Set(prev);
      next.delete(noteLabel);
      return next;
    });
    
    // Ensure animation state is cleared if released quickly
    setPressingKeys(prev => {
      const next = new Set(prev);
      next.delete(noteLabel);
      return next;
    });
  }, [onNoteEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const noteLabel = KEY_BINDINGS[e.key.toLowerCase()];
      if (noteLabel) {
        const noteData = NOTES.find(n => n.label === noteLabel);
        if (noteData) handleKeyStart(noteLabel, noteData.freq);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const noteLabel = KEY_BINDINGS[e.key.toLowerCase()];
      if (noteLabel) handleKeyEnd(noteLabel);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleKeyStart, handleKeyEnd]);

  const handleNoteAction = (noteLabel: string, freq: number, isStart: boolean) => {
    if (isPanning && hasMoved.current) return;
    if (isStart) handleKeyStart(noteLabel, freq);
    else handleKeyEnd(noteLabel);
  };

  const startPanning = (clientX: number) => {
    setIsPanning(true);
    hasMoved.current = false;
    dragStartX.current = clientX;
    scrollStartX.current = containerRef.current?.scrollLeft || 0;
  };

  const onPanning = (clientX: number) => {
    if (!isPanning || !containerRef.current) return;
    const dx = clientX - dragStartX.current;
    if (Math.abs(dx) > 5) hasMoved.current = true;
    containerRef.current.scrollLeft = scrollStartX.current - dx;
  };

  const stopPanning = () => {
    setIsPanning(false);
  };

  return (
    <div 
      ref={containerRef}
      className="w-full h-full bg-black overflow-x-auto no-scrollbar touch-none select-none flex flex-col relative"
      onMouseDown={(e) => startPanning(e.clientX)}
      onMouseMove={(e) => onPanning(e.clientX)}
      onMouseUp={stopPanning}
      onMouseLeave={stopPanning}
      onTouchStart={(e) => startPanning(e.touches[0].clientX)}
      onTouchMove={(e) => onPanning(e.touches[0].clientX)}
      onTouchEnd={stopPanning}
    >
      <div className="flex-1 flex gap-px relative min-w-max h-full p-2 pt-4 pb-12">
        {NOTES.map((note) => {
          const isBlack = note.label.includes('#');
          const isActive = activeKeys.has(note.label);
          const isPressing = pressingKeys.has(note.label);
          
          return (
            <div
              key={note.label}
              onMouseDown={(e) => { e.stopPropagation(); handleNoteAction(note.label, note.freq, true); }}
              onMouseUp={(e) => { e.stopPropagation(); handleNoteAction(note.label, note.freq, false); }}
              onMouseEnter={(e) => { if (e.buttons === 1) handleNoteAction(note.label, note.freq, true); }}
              onMouseLeave={(e) => { handleNoteAction(note.label, note.freq, false); }}
              onTouchStart={(e) => { e.stopPropagation(); handleNoteAction(note.label, note.freq, true); }}
              onTouchEnd={(e) => { e.stopPropagation(); handleNoteAction(note.label, note.freq, false); }}
              className={`
                flex flex-col items-center justify-end pb-8 cursor-pointer rounded-b-2xl relative transition-all
                ${isBlack 
                  ? `bg-zinc-900 w-10 sm:w-12 h-[60%] z-20 -mx-5 sm:-mx-6 border-x border-b border-zinc-700 black-key ${isActive ? 'black-key-active' : ''}` 
                  : `bg-white w-16 sm:w-20 h-full border border-zinc-200 z-10 white-key ${isActive ? 'white-key-active' : ''}`}
                ${isActive ? 'key-active' : ''}
                ${isPressing ? 'key-pressing' : ''}
              `}
            >
              {/* Note Key Binding Indicator */}
              <div className={`flex flex-col items-center leading-none transition-all duration-150 pointer-events-none mb-3 ${isActive ? 'key-label-active' : 'opacity-40'}`}>
                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${isBlack ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {Object.keys(KEY_BINDINGS).find(k => KEY_BINDINGS[k] === note.label)?.toUpperCase()}
                </span>
                <span className={`text-[9px] sm:text-[10px] font-bold mt-1 ${isBlack ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {note.label}
                </span>
              </div>
              
              {/* Vibrant Cyan Active Accent (Especially distinct for mobile) */}
              {isActive && (
                <div className={`
                  absolute inset-x-1 sm:inset-x-2 bottom-2 rounded-full transition-all duration-300
                  ${isBlack ? 'h-1.5 bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.8)]' : 'h-2 bg-cyan-500 shadow-[0_0_20px_rgba(6,182,212,1)]'}
                  animate-pulse
                `} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Keyboard;
