
import React, { useEffect, useState, useRef } from 'react';
import { NOTES, KEY_BINDINGS } from '../constants';
import { SynthSettings } from '../types';

interface KeyboardProps {
  onNoteStart: (note: string, freq: number) => void;
  onNoteEnd: (note: string) => void;
  settings: SynthSettings;
}

const Keyboard: React.FC<KeyboardProps> = ({ onNoteStart, onNoteEnd }) => {
  const [activeKeys, setActiveKeys] = useState<Set<string>>(new Set());
  const pressedKeysRef = useRef<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Drag states
  const [isPanning, setIsPanning] = useState(false);
  const dragStartX = useRef(0);
  const scrollStartX = useRef(0);
  const hasMoved = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent key repeat and don't trigger if user is typing in an input (e.g. preset name)
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      
      const noteLabel = KEY_BINDINGS[e.key.toLowerCase()];
      if (noteLabel && !pressedKeysRef.current.has(noteLabel)) {
        const noteData = NOTES.find(n => n.label === noteLabel);
        if (noteData) {
          onNoteStart(noteLabel, noteData.freq);
          pressedKeysRef.current.add(noteLabel);
          setActiveKeys(prev => new Set(prev).add(noteLabel));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const noteLabel = KEY_BINDINGS[e.key.toLowerCase()];
      if (noteLabel && pressedKeysRef.current.has(noteLabel)) {
        onNoteEnd(noteLabel);
        pressedKeysRef.current.delete(noteLabel);
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.delete(noteLabel);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [onNoteStart, onNoteEnd]);

  const handleNoteAction = (noteLabel: string, freq: number, isStart: boolean) => {
    // If we are panning, don't trigger notes
    if (isPanning && hasMoved.current) return;

    if (isStart) {
      if (!pressedKeysRef.current.has(noteLabel)) {
        onNoteStart(noteLabel, freq);
        pressedKeysRef.current.add(noteLabel);
        setActiveKeys(prev => new Set(prev).add(noteLabel));
      }
    } else {
      if (pressedKeysRef.current.has(noteLabel)) {
        onNoteEnd(noteLabel);
        pressedKeysRef.current.delete(noteLabel);
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.delete(noteLabel);
          return next;
        });
      }
    }
  };

  // Drag Panning Logic
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
      <div className="flex-1 flex gap-px relative min-w-max h-full p-2 pb-8">
        {NOTES.map((note) => {
          const isBlack = note.label.includes('#');
          const isActive = activeKeys.has(note.label);
          const keyClass = isBlack ? 'black-key' : 'white-key';
          const activeClass = isBlack ? 'black-key-active' : 'white-key-active';
          
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
                flex flex-col items-center justify-end pb-6 transition-all duration-100 cursor-pointer rounded-b-2xl shadow-lg relative
                ${isBlack 
                  ? 'bg-zinc-900 w-10 sm:w-12 h-[60%] z-20 -mx-5 sm:-mx-6 border-x border-b border-zinc-700' 
                  : 'bg-white w-16 sm:w-20 h-full border border-zinc-200 z-10'}
                ${keyClass}
                ${isActive ? `key-active ${activeClass} ring-1 ring-cyan-500/30` : ''}
              `}
            >
              {/* Note Key Binding Indicator */}
              <div className={`flex flex-col items-center leading-none transition-all duration-150 pointer-events-none mb-2 ${isActive ? 'key-label-active' : 'opacity-40'}`}>
                <span className={`text-[8px] sm:text-[9px] font-black uppercase tracking-tighter ${isBlack ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {Object.keys(KEY_BINDINGS).find(k => KEY_BINDINGS[k] === note.label)?.toUpperCase()}
                </span>
                <span className={`text-[9px] sm:text-[10px] font-bold mt-1 ${isBlack ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {note.label}
                </span>
              </div>
              
              {/* Active Glow Accent for white keys */}
              {!isBlack && isActive && (
                <div className="absolute inset-x-2 bottom-2 h-0.5 bg-cyan-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.8)]" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Keyboard;