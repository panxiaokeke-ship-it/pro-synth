
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
  const onNoteStartRef = useRef(onNoteStart);
  const onNoteEndRef = useRef(onNoteEnd);

  useEffect(() => {
    onNoteStartRef.current = onNoteStart;
    onNoteEndRef.current = onNoteEnd;
  }, [onNoteStart, onNoteEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const noteLabel = KEY_BINDINGS[e.key.toLowerCase()];
      if (noteLabel && !pressedKeysRef.current.has(noteLabel)) {
        const noteData = NOTES.find(n => n.label === noteLabel);
        if (noteData) {
          onNoteStartRef.current(noteLabel, noteData.freq);
          pressedKeysRef.current.add(noteLabel);
          setActiveKeys(prev => new Set(prev).add(noteLabel));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      const noteLabel = KEY_BINDINGS[e.key.toLowerCase()];
      if (noteLabel && pressedKeysRef.current.has(noteLabel)) {
        onNoteEndRef.current(noteLabel);
        pressedKeysRef.current.delete(noteLabel);
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.delete(noteLabel);
          return next;
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown, { passive: true });
    window.addEventListener('keyup', handleKeyUp, { passive: true });
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const handleNoteAction = (noteLabel: string, freq: number, isStart: boolean) => {
    if (isStart) {
      if (!pressedKeysRef.current.has(noteLabel)) {
        onNoteStartRef.current(noteLabel, freq);
        pressedKeysRef.current.add(noteLabel);
        setActiveKeys(prev => new Set(prev).add(noteLabel));
      }
    } else {
      if (pressedKeysRef.current.has(noteLabel)) {
        onNoteEndRef.current(noteLabel);
        pressedKeysRef.current.delete(noteLabel);
        setActiveKeys(prev => {
          const next = new Set(prev);
          next.delete(noteLabel);
          return next;
        });
      }
    }
  };

  return (
    <div className="flex-1 w-full bg-black overflow-x-auto no-scrollbar touch-pan-x select-none flex flex-col pt-1">
      <div className="flex-1 flex gap-px relative min-w-max h-full">
        {NOTES.map((note) => {
          const isBlack = note.label.includes('#');
          const isActive = activeKeys.has(note.label);
          // Large, touch-friendly widths: 80px white, 48px black
          return (
            <div
              key={note.label}
              onMouseDown={(e) => { e.preventDefault(); handleNoteAction(note.label, note.freq, true); }}
              onMouseUp={(e) => { e.preventDefault(); handleNoteAction(note.label, note.freq, false); }}
              onMouseLeave={() => handleNoteAction(note.label, note.freq, false)}
              onTouchStart={(e) => { e.preventDefault(); handleNoteAction(note.label, note.freq, true); }}
              onTouchEnd={(e) => { e.preventDefault(); handleNoteAction(note.label, note.freq, false); }}
              className={`
                flex flex-col items-center justify-end pb-6 transition-all duration-75 cursor-pointer rounded-b-2xl shadow-2xl relative
                ${isBlack 
                  ? 'bg-zinc-900 w-12 h-[60%] z-10 -mx-6 border-x border-b border-zinc-800 hover:bg-zinc-800' 
                  : 'bg-white w-20 h-full border border-zinc-200 hover:bg-zinc-50'}
                ${isActive ? 'brightness-75 transform translate-y-2 border-cyan-500 shadow-inner scale-y-[0.98]' : ''}
              `}
            >
              {/* Keyboard Shortcut Indicator */}
              <div className="flex flex-col items-center leading-none opacity-20 pointer-events-none mb-4">
                <span className={`text-[8px] font-black uppercase ${isBlack ? 'text-zinc-500' : 'text-zinc-400'}`}>
                  {Object.keys(KEY_BINDINGS).find(k => KEY_BINDINGS[k] === note.label)?.toUpperCase()}
                </span>
                <span className={`text-[9px] font-black ${isBlack ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {note.label}
                </span>
              </div>
              
              {isActive && (
                <div className="absolute inset-0 bg-cyan-500/10 pointer-events-none rounded-b-2xl" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Keyboard;
