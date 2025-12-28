
import React, { useState, useEffect, useRef } from 'react';
import { NoteEvent, RecordedLoop, SynthSettings, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Circle, Play, Square, Trash2, Repeat, Disc } from 'lucide-react';

interface LooperProps {
  currentNotes: NoteEvent[];
  settings: SynthSettings;
  onPlayEvent: (note: string, freq: number) => void;
  onStopEvent: (note: string) => void;
  lang: Language;
}

const Looper: React.FC<LooperProps> = ({ currentNotes, settings, onPlayEvent, onStopEvent, lang }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);
  const [loops, setLoops] = useState<RecordedLoop[]>([]);
  const [recordedEvents, setRecordedEvents] = useState<NoteEvent[]>([]);
  const [repeatEnabled, setRepeatEnabled] = useState<Record<string, boolean>>({});
  
  const t = TRANSLATIONS[lang];
  const recordingStartTime = useRef<number>(0);
  const playbackTimers = useRef<number[]>([]);

  useEffect(() => {
    if (isRecording && currentNotes.length > 0) {
      const latest = currentNotes[currentNotes.length - 1];
      setRecordedEvents(prev => [...prev, { ...latest, timestamp: Date.now() - recordingStartTime.current }]);
    }
  }, [currentNotes, isRecording]);

  const stopRecording = () => {
    setIsRecording(false);
    if (recordedEvents.length > 0) {
      const duration = Date.now() - recordingStartTime.current;
      const newId = Math.random().toString(36).substr(2, 9);
      setLoops(prev => [...prev, { id: newId, name: `LOOP ${loops.length + 1}`, events: [...recordedEvents], duration }]);
      setRepeatEnabled(prev => ({ ...prev, [newId]: true }));
    }
  };

  const playLoop = (loop: RecordedLoop) => {
    stopPlayback();
    setPlayingLoopId(loop.id);
    const executePlayback = () => {
      loop.events.forEach((event) => {
        const p = window.setTimeout(() => onPlayEvent(event.note, event.frequency), event.timestamp);
        const s = window.setTimeout(() => onStopEvent(event.note), event.timestamp + 300);
        playbackTimers.current.push(p, s);
      });
      playbackTimers.current.push(window.setTimeout(() => {
        if (repeatEnabled[loop.id]) executePlayback();
        else setPlayingLoopId(null);
      }, loop.duration));
    };
    executePlayback();
  };

  const stopPlayback = () => {
    setPlayingLoopId(null);
    playbackTimers.current.forEach(clearTimeout);
    playbackTimers.current = [];
  };

  return (
    <div className="h-full flex items-center gap-3 px-1 overflow-x-auto no-scrollbar">
      {/* Primary Rec Trigger */}
      <div className="flex shrink-0">
        {!isRecording ? (
          <button 
            onClick={() => { setIsRecording(true); setRecordedEvents([]); recordingStartTime.current = Date.now(); }} 
            className="flex items-center gap-1.5 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-[9px] font-black uppercase text-zinc-400 hover:text-red-500 hover:border-red-500/50 active:scale-95 transition-all"
          >
            <Circle size={10} fill="currentColor" /> {t.rec}
          </button>
        ) : (
          <button 
            onClick={stopRecording} 
            className="flex items-center gap-1.5 px-3 py-1 bg-red-600 border border-red-500 rounded-full text-[9px] font-black uppercase text-white animate-pulse active:scale-95 shadow-[0_0_10px_rgba(220,38,38,0.5)]"
          >
            <Square size={10} fill="white" /> {t.stop}
          </button>
        )}
      </div>

      {/* Loops List */}
      <div className="flex gap-1.5 items-center">
        {loops.length === 0 ? (
          <div className="flex items-center gap-1 text-[7px] font-black text-zinc-700 uppercase tracking-widest px-2 italic">
            <Disc size={8} className="animate-spin-slow" /> {t.noLoops}
          </div>
        ) : (
          loops.map((loop) => {
            const isActive = playingLoopId === loop.id;
            return (
              <div key={loop.id} className={`flex items-center gap-2 px-2 py-0.5 rounded-lg border text-[8px] font-black transition-all ${isActive ? 'bg-cyan-500/10 border-cyan-500 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}>
                <span className="truncate max-w-[40px]">{loop.name}</span>
                <div className="flex gap-1 border-l border-zinc-800/50 pl-1.5">
                  <button 
                    onClick={() => setRepeatEnabled(p => ({...p, [loop.id]: !p[loop.id]}))} 
                    className={`hover:scale-110 transition-transform ${repeatEnabled[loop.id] ? 'text-cyan-500' : 'text-zinc-800'}`}
                  >
                    <Repeat size={10}/>
                  </button>
                  <button 
                    onClick={() => isActive ? stopPlayback() : playLoop(loop)}
                    className="hover:scale-110 transition-transform active:text-white"
                  >
                    {isActive ? <Square size={10} fill="currentColor"/> : <Play size={10} fill="currentColor"/>}
                  </button>
                  <button 
                    onClick={() => { stopPlayback(); setLoops(prev => prev.filter(l => l.id !== loop.id)); }} 
                    className="text-zinc-800 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={10}/>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Looper;
