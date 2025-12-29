
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NoteEvent, RecordedLoop, SynthSettings, Language } from '../types';
import { TRANSLATIONS } from '../constants';
// Import audioEngine to enable metronome functionality
import { audioEngine } from '../services/audioEngine';
import { 
  Circle, Play, Square, Music, Trash2, Repeat, ChevronDown, ChevronUp, Clock, 
  Volume2, Settings2, Edit3, Check, X, MousePointer2, AlertCircle, Undo2, Redo2
} from 'lucide-react';

interface LooperProps {
  currentNotes: NoteEvent[];
  settings: SynthSettings;
  onPlayEvent: (note: string, freq: number) => void;
  onStopEvent: (note: string) => void;
  lang: Language;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const Looper: React.FC<LooperProps> = ({ 
  currentNotes, settings, onPlayEvent, onStopEvent, lang, isExpanded, onToggleExpand 
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [playingLoopId, setPlayingLoopId] = useState<string | null>(null);
  const [loops, setLoops] = useState<RecordedLoop[]>([]);
  const [recordedEvents, setRecordedEvents] = useState<NoteEvent[]>([]);
  const [repeatEnabled, setRepeatEnabled] = useState<Record<string, boolean>>({});
  const [metronomeEnabled, setMetronomeEnabled] = useState(false);
  const [editingLoopId, setEditingLoopId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [loopProgress, setLoopProgress] = useState<Record<string, number>>({});
  
  // Undo/Redo Stacks
  const [undoStack, setUndoStack] = useState<RecordedLoop[][]>([]);
  const [redoStack, setRedoStack] = useState<RecordedLoop[][]>([]);

  const t = TRANSLATIONS[lang];
  const recordingStartTime = useRef<number>(0);
  const playbackTimers = useRef<number[]>([]);
  const progressIntervals = useRef<Record<string, number>>({});

  // Helper to push history state
  const pushToHistory = useCallback((currentLoops: RecordedLoop[]) => {
    setUndoStack(prev => [...prev, [...currentLoops]].slice(-20)); // Limit history to 20 steps
    setRedoStack([]); // Clear redo on new action
  }, []);

  const performUndo = useCallback(() => {
    if (undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, [...loops]]);
    setUndoStack(prev => prev.slice(0, -1));
    setLoops(previous);
    stopPlayback();
  }, [undoStack, loops]);

  const performRedo = useCallback(() => {
    if (redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, [...loops]]);
    setRedoStack(prev => prev.slice(0, -1));
    setLoops(next);
    stopPlayback();
  }, [redoStack, loops]);

  // Keyboard shortcuts for Undo/Redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault();
        if (e.shiftKey) performRedo();
        else performUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        performRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [performUndo, performRedo]);

  useEffect(() => {
    if (isRecording && currentNotes.length > 0) {
      const latest = currentNotes[currentNotes.length - 1];
      setRecordedEvents(prev => [...prev, { ...latest, timestamp: Date.now() - recordingStartTime.current }]);
    }
  }, [currentNotes, isRecording]);

  const startRecording = () => {
    setIsRecording(true);
    setRecordedEvents([]);
    recordingStartTime.current = Date.now();
    if (metronomeEnabled) {
      audioEngine.playNote(880, "METRO", { ...settings, envelope: { attack: 0.01, decay: 0.05, sustain: 0, release: 0.01 }});
      setTimeout(() => audioEngine.stopNote("METRO", settings), 100);
    }
  };

  const stopRecording = () => {
    setIsRecording(false);
    if (recordedEvents.length > 0) {
      pushToHistory(loops);
      const newId = Math.random().toString(36).substr(2, 9);
      const loopDuration = Date.now() - recordingStartTime.current;
      setLoops(prev => [...prev, { 
        id: newId, 
        name: `LOOP ${loops.length + 1}`, 
        events: [...recordedEvents], 
        duration: loopDuration 
      }]);
      setRepeatEnabled(prev => ({ ...prev, [newId]: true }));
    }
  };

  const playLoop = (loop: RecordedLoop) => {
    if (playingLoopId === loop.id) {
      stopPlayback();
      return;
    }
    stopPlayback();
    setPlayingLoopId(loop.id);

    const executePlayback = () => {
      const loopStartTime = Date.now();
      
      const progInt = window.setInterval(() => {
        const elapsed = Date.now() - loopStartTime;
        setLoopProgress(prev => ({ ...prev, [loop.id]: (elapsed / loop.duration) * 100 }));
      }, 16);
      progressIntervals.current[loop.id] = progInt;

      loop.events.forEach((event) => {
        const playTimer = window.setTimeout(() => onPlayEvent(event.note, event.frequency), event.timestamp);
        const stopTimer = window.setTimeout(() => onStopEvent(event.note), event.timestamp + 300);
        playbackTimers.current.push(playTimer, stopTimer);
      });

      const endTimer = window.setTimeout(() => {
        window.clearInterval(progInt);
        if (repeatEnabled[loop.id]) {
          executePlayback();
        } else {
          setPlayingLoopId(null);
          setLoopProgress(prev => ({ ...prev, [loop.id]: 0 }));
        }
      }, loop.duration);
      playbackTimers.current.push(endTimer);
    };

    executePlayback();
  };

  const stopPlayback = () => {
    setPlayingLoopId(null);
    playbackTimers.current.forEach(clearTimeout);
    playbackTimers.current = [];
    Object.values(progressIntervals.current).forEach(clearInterval);
    progressIntervals.current = {};
    setLoopProgress({});
  };

  const saveEdit = (id: string) => {
    pushToHistory(loops);
    setLoops(prev => prev.map(l => l.id === id ? { ...l, name: editName || l.name } : l));
    setEditingLoopId(null);
  };

  const deleteLoop = (id: string) => {
    pushToHistory(loops);
    if(playingLoopId === id) stopPlayback();
    setLoops(prev => prev.filter(l => l.id !== id));
  };

  const clearAllLoops = () => {
    pushToHistory(loops);
    stopPlayback();
    setLoops([]);
  };

  return (
    <div className="relative h-full flex items-center min-w-0">
      {/* COMPACT VIEW (Always in Header) */}
      <div className="flex items-center gap-2 h-full bg-black/40 px-2 rounded-lg border border-zinc-800/50">
        <div className="flex items-center gap-1.5 shrink-0 border-r border-zinc-800 pr-2">
          {!isRecording ? (
            <button 
              onClick={startRecording} 
              className="w-7 h-7 flex items-center justify-center bg-red-600 rounded-full active:scale-90 transition-transform shadow-lg shadow-red-900/20 group"
              title="Start Recording"
            >
              <Circle size={12} fill="white" className="group-hover:scale-110 transition-transform" />
            </button>
          ) : (
            <button 
              onClick={stopRecording} 
              className="w-7 h-7 flex items-center justify-center bg-white text-black rounded-full animate-pulse shadow-lg"
              title="Stop Recording"
            >
              <Square size={10} fill="black" />
            </button>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-center gap-3">
          {playingLoopId ? (
            <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-300">
              <Play size={10} className="text-cyan-500 fill-cyan-500 animate-pulse" />
              <span className="text-[9px] font-black text-cyan-400 uppercase tracking-widest truncate max-w-[80px]">
                {loops.find(l => l.id === playingLoopId)?.name}
              </span>
            </div>
          ) : (
            <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-widest truncate opacity-50">
              {loops.length > 0 ? `${loops.length} Loops Saved` : 'No Loops'}
            </span>
          )}
        </div>

        <button 
          onClick={onToggleExpand}
          className={`p-1.5 rounded-md transition-all ${isExpanded ? 'bg-zinc-800 text-cyan-400' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'}`}
          title={isExpanded ? "Close Looper" : "Open Looper Management"}
        >
          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </button>
      </div>

      {/* EXPANDED PANEL (Slides down) */}
      {isExpanded && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-80 sm:w-96 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-4 overflow-hidden flex flex-col max-h-[70vh]">
          {/* Panel Header */}
          <div className="p-3 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-400 flex items-center gap-2">
              <Music size={14} className="text-cyan-500" /> Loop Management
            </h3>
            <div className="flex items-center gap-1">
               {/* Undo/Redo Buttons */}
               <button 
                onClick={performUndo}
                disabled={undoStack.length === 0}
                className={`p-1.5 rounded transition-all ${undoStack.length > 0 ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-800 cursor-not-allowed'}`}
                title="Undo (Ctrl+Z)"
               >
                 <Undo2 size={12} />
               </button>
               <button 
                onClick={performRedo}
                disabled={redoStack.length === 0}
                className={`p-1.5 rounded transition-all ${redoStack.length > 0 ? 'text-zinc-400 hover:text-white hover:bg-zinc-800' : 'text-zinc-800 cursor-not-allowed'}`}
                title="Redo (Ctrl+Y)"
               >
                 <Redo2 size={12} />
               </button>
               
               <div className="w-px h-4 bg-zinc-800 mx-1" />

               <button 
                onClick={() => setMetronomeEnabled(!metronomeEnabled)}
                className={`p-1.5 rounded flex items-center gap-1.5 transition-all ${metronomeEnabled ? 'text-amber-500 bg-amber-500/10' : 'text-zinc-600 hover:text-zinc-400'}`}
                title="Metronome Click"
               >
                 <Clock size={12} />
                 <span className="text-[8px] font-black uppercase">Click</span>
               </button>
               {loops.length > 0 && (
                 <button onClick={clearAllLoops} className="text-red-500 hover:text-red-400 p-1 ml-1" title="Delete All">
                   <Trash2 size={12} />
                 </button>
               )}
            </div>
          </div>

          {/* Loops List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar no-scrollbar">
            {loops.length === 0 ? (
              <div className="py-12 flex flex-col items-center justify-center text-zinc-700 opacity-50">
                <Music size={32} className="mb-2 stroke-[1px]" />
                <p className="text-[10px] font-black uppercase tracking-widest text-center px-8">
                  No recording found.<br/>Press red button to start capturing your performance.
                </p>
              </div>
            ) : (
              loops.map((loop) => {
                const isActive = playingLoopId === loop.id;
                const isRepeating = repeatEnabled[loop.id];
                const progress = loopProgress[loop.id] || 0;
                const isEditing = editingLoopId === loop.id;

                return (
                  <div 
                    key={loop.id} 
                    className={`group relative p-3 rounded-xl border transition-all ${isActive ? 'bg-cyan-900/10 border-cyan-500/50' : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-900 hover:border-zinc-700'}`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1">
                          <input 
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && saveEdit(loop.id)}
                            className="bg-zinc-950 border border-zinc-800 rounded px-2 py-0.5 text-[10px] font-black text-cyan-400 w-full focus:outline-none focus:border-cyan-500"
                          />
                          <button onClick={() => saveEdit(loop.id)} className="text-green-500 hover:text-green-400"><Check size={12} /></button>
                          <button onClick={() => setEditingLoopId(null)} className="text-red-500 hover:text-red-400"><X size={12} /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 group/title">
                          <span className="text-[10px] font-black text-zinc-200 uppercase tracking-tight">{loop.name}</span>
                          <button 
                            onClick={() => { setEditingLoopId(loop.id); setEditName(loop.name); }}
                            className="opacity-0 group-hover/title:opacity-100 transition-opacity text-zinc-600 hover:text-cyan-400"
                          >
                            <Edit3 size={10} />
                          </button>
                        </div>
                      )}
                      <span className="text-[9px] mono text-zinc-600 font-bold">{(loop.duration/1000).toFixed(2)}s</span>
                    </div>

                    {/* Progress Bar Container */}
                    <div className="h-1 bg-zinc-950 rounded-full overflow-hidden mb-3 relative">
                      <div 
                        className={`h-full absolute left-0 top-0 transition-all duration-[16ms] ${isActive ? 'bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.5)]' : 'bg-zinc-800'}`}
                        style={{ width: `${progress}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1">
                        <button 
                          onClick={() => setRepeatEnabled(p => ({...p, [loop.id]: !p[loop.id]}))}
                          className={`p-1.5 rounded-lg border transition-all ${isRepeating ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400' : 'bg-zinc-950 border-zinc-800 text-zinc-700 hover:text-zinc-500'}`}
                          title="Repeat Loop"
                        >
                          <Repeat size={12} />
                        </button>
                        <button 
                          className="p-1.5 rounded-lg border bg-zinc-950 border-zinc-800 text-zinc-700 hover:text-zinc-500"
                          title="Loop Effects (Coming Soon)"
                        >
                          <Settings2 size={12} />
                        </button>
                      </div>

                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => playLoop(loop)} 
                          className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${isActive ? 'bg-zinc-700 text-zinc-200' : 'bg-cyan-600 hover:bg-cyan-500 text-black shadow-lg shadow-cyan-900/10'}`}
                        >
                          {isActive ? <Square size={10} fill="currentColor" /> : <Play size={10} fill="currentColor" />}
                          {isActive ? 'Stop' : 'Play'}
                        </button>
                        <button 
                          onClick={() => deleteLoop(loop.id)}
                          className="p-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-zinc-700 hover:text-red-500 hover:border-red-500/50 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Panel Footer */}
          <div className="p-3 border-t border-zinc-800 bg-zinc-950 flex items-center justify-center gap-2">
            <AlertCircle size={10} className="text-zinc-700" />
            <span className="text-[8px] font-black uppercase text-zinc-700 tracking-widest">Storage: Local Browser Persistence</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Looper;
