
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DEFAULT_SETTINGS, midiNoteToFrequency, getNoteLabel, TRANSLATIONS } from './constants';
import { SynthSettings, NoteEvent, EnvelopeSettings, StoredPreset, Language, MIDIMapping } from './types';
import { audioEngine } from './services/audioEngine';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import Keyboard from './components/Keyboard';
import Looper from './components/Looper';
import { 
  Activity, Layers, X, Globe, Monitor, Save, Trash2, MoreVertical, Settings, Volume2, Cpu, Link, Zap, ChevronDown, ChevronUp
} from 'lucide-react';

const ENVELOPE_PRESETS: Record<string, { labelKey: keyof typeof TRANSLATIONS.en; settings: EnvelopeSettings }> = {
  fast: { labelKey: 'fastAttack', settings: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } },
  slow: { labelKey: 'slowAttack', settings: { attack: 1.2, decay: 0.4, sustain: 0.7, release: 1.5 } },
  sustained: { labelKey: 'sustained', settings: { attack: 0.2, decay: 0.2, sustain: 1.0, release: 0.8 } },
  quick: { labelKey: 'quickRelease', settings: { attack: 0.05, decay: 0.1, sustain: 0.2, release: 0.05 } }
};

export const MAPPABLE_PARAMS = [
  { id: 'filter.frequency', label: 'Filter Cutoff', min: 20, max: 15000 },
  { id: 'filter.resonance', label: 'Filter Resonance', min: 0.1, max: 20 },
  { id: 'envelope.attack', label: 'Attack', min: 0.01, max: 2 },
  { id: 'envelope.decay', label: 'Decay', min: 0.01, max: 2 },
  { id: 'envelope.sustain', label: 'Sustain', min: 0.01, max: 1 },
  { id: 'envelope.release', label: 'Release', min: 0.01, max: 3 },
  { id: 'gain', label: 'Master Volume', min: 0, max: 1 },
  { id: 'detune', label: 'Detune', min: -100, max: 100 },
  { id: 'stereoWidth', label: 'Stereo Width', min: 0, max: 1 },
  { id: 'reverb', label: 'Reverb Mix', min: 0, max: 0.8 },
  { id: 'delay', label: 'Delay Mix', min: 0, max: 0.8 },
  { id: 'glideSpeed', label: 'Glide Speed', min: 0.01, max: 1 },
];

const STORAGE_KEY = 'gemini_synth_presets_v2';
const MIDI_STORAGE_KEY = 'gemini_synth_midi_mappings';
const LANG_STORAGE_KEY = 'gemini_synth_lang';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem(LANG_STORAGE_KEY) as Language) || 'zh');
  const [settings, setSettings] = useState<SynthSettings>(DEFAULT_SETTINGS);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const [presetName, setPresetName] = useState("Default Lead");
  const [lastNoteEvents, setLastNoteEvents] = useState<NoteEvent[]>([]);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [savedPresets, setSavedPresets] = useState<StoredPreset[]>([]);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [isLooperExpanded, setIsLooperExpanded] = useState(false);

  // MIDI CC Mapping State
  const [isLearnModeActive, setIsLearnModeActive] = useState(false);
  const [midiMappings, setMidiMappings] = useState<MIDIMapping>(() => {
    const raw = localStorage.getItem(MIDI_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { 1: 'filter.frequency', 7: 'gain' };
  });
  const [learningParam, setLearningParam] = useState<string | null>(null);

  const t = TRANSLATIONS[lang];

  useEffect(() => { settingsRef.current = settings; }, [settings]);
  useEffect(() => { localStorage.setItem(LANG_STORAGE_KEY, lang); }, [lang]);
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) try { setSavedPresets(JSON.parse(raw)); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPresets)); }, [savedPresets]);
  useEffect(() => { localStorage.setItem(MIDI_STORAGE_KEY, JSON.stringify(midiMappings)); }, [midiMappings]);
  
  useEffect(() => { 
    audioEngine.updateSettings(settings); 
  }, [settings]);

  const handleNoteStart = useCallback((note: string, freq: number) => {
    audioEngine.playNote(freq, note, settingsRef.current);
    setLastNoteEvents(prev => [...prev, { note, frequency: freq, timestamp: Date.now(), startTime: Date.now() }]);
  }, []);

  const handleNoteEnd = useCallback((note: string) => {
    audioEngine.stopNote(note, settingsRef.current);
  }, []);

  const updateNestedSetting = (path: string, value: number) => {
    setSettings(prev => {
      const next = { ...prev };
      const parts = path.split('.');
      if (parts.length === 2) {
        (next as any)[parts[0]] = { ...(next as any)[parts[0]], [parts[1]]: value };
      } else {
        if (path === 'glide') {
          (next as any)[path] = value > 0.5;
        } else {
          (next as any)[parts[0]] = value;
        }
      }
      return next;
    });
  };

  const handleMIDIMessage = useCallback((message: any) => {
    const [status, data1, data2] = message.data;
    const command = status & 0xF0;

    if (command === 0x90 && data2 > 0) handleNoteStart(getNoteLabel(data1), midiNoteToFrequency(data1));
    else if (command === 0x80 || (command === 0x90 && data2 === 0)) handleNoteEnd(getNoteLabel(data1));
    
    else if (command === 0xB0) {
      const ccNumber = data1;
      const ccValue = data2; 

      if (learningParam) {
        setMidiMappings(prev => {
          const next = { ...prev };
          delete next[ccNumber];
          Object.keys(next).forEach(key => {
            if (next[parseInt(key)] === learningParam) delete next[parseInt(key)];
          });
          next[ccNumber] = learningParam;
          return next;
        });
        setLearningParam(null);
      } else {
        const paramPath = midiMappings[ccNumber];
        if (paramPath) {
          const paramDef = MAPPABLE_PARAMS.find(p => p.id === paramPath);
          if (paramDef) {
            const normalizedValue = (ccValue / 127) * (paramDef.max - paramDef.min) + paramDef.min;
            updateNestedSetting(paramPath, normalizedValue);
          }
        }
      }
    }
  }, [handleNoteStart, handleNoteEnd, learningParam, midiMappings]);

  const handleSaveCurrent = () => {
    if (!saveName.trim()) return;
    const newPreset: StoredPreset = { id: Math.random().toString(36).substr(2, 9), name: saveName.trim(), settings: { ...settings }, timestamp: Date.now() };
    setSavedPresets(prev => [newPreset, ...prev]);
    setPresetName(saveName.trim());
    setIsSaving(false);
    setSaveName("");
  };

  const loadPreset = (preset: StoredPreset) => {
    setSettings(preset.settings);
    setPresetName(preset.name);
    setIsMoreMenuOpen(false);
  };

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then((midiAccess: any) => {
      setMidiEnabled(true);
      midiAccess.inputs.forEach((input: any) => {
        input.onmidimessage = handleMIDIMessage;
      });
    }, () => setMidiEnabled(false));
  }, [handleMIDIMessage]);

  return (
    <div className="h-screen w-screen bg-[#0a0a0c] text-zinc-200 flex flex-col overflow-hidden select-none">
      {/* HEADER BAR */}
      <header className="h-12 px-4 flex items-center bg-zinc-950 border-b border-zinc-800 shrink-0 z-50">
        <div className="flex items-center gap-2 mr-4">
          <Activity size={18} className="text-cyan-500 animate-pulse" />
          <div className="flex flex-col">
            <span className="text-[10px] font-black uppercase tracking-widest text-white leading-none">PRO SYNTH</span>
            <span className="text-[8px] font-bold text-zinc-500 mono leading-none mt-1">FIELD UNIT v2.5</span>
          </div>
        </div>

        <div className="flex-1 flex items-center h-full">
           <Looper 
            currentNotes={lastNoteEvents} 
            settings={settings} 
            onPlayEvent={handleNoteStart} 
            onStopEvent={handleNoteEnd} 
            lang={lang}
            isExpanded={isLooperExpanded}
            onToggleExpand={() => setIsLooperExpanded(!isLooperExpanded)}
          />
        </div>

        <div className="flex items-center gap-2 ml-4">
          <button 
            onClick={() => setIsLearnModeActive(!isLearnModeActive)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border transition-all duration-300 ${isLearnModeActive ? 'bg-amber-500 border-amber-400 text-black shadow-[0_0_15px_rgba(245,158,11,0.3)]' : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:text-zinc-300'}`}
          >
            <Zap size={14} className={isLearnModeActive ? 'animate-bounce' : ''} />
            <span className="text-[9px] font-black uppercase tracking-tighter hidden sm:inline">{isLearnModeActive ? 'LEARNING...' : 'MIDI LEARN'}</span>
          </button>

          <div className="hidden sm:block w-24 h-8 rounded border border-zinc-800 overflow-hidden bg-black/40">
            <Visualizer settings={settings} />
          </div>
          <button 
            onClick={() => setIsMoreMenuOpen(true)} 
            className="p-2 bg-zinc-900 rounded-lg border border-zinc-800 text-zinc-400 hover:text-white transition-colors"
          >
            <MoreVertical size={20} />
          </button>
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-0 bg-black relative">
        {/* MIDI LEARN ALERT */}
        {isLearnModeActive && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 py-1.5 px-4 flex items-center justify-between animate-in fade-in slide-in-from-top-2 z-40">
            <div className="flex items-center gap-2">
              <Zap size={10} className="text-amber-500" />
              <span className="text-[8px] font-black uppercase text-amber-500 tracking-[0.2em]">
                {learningParam ? `Awaiting MIDI CC for: ${learningParam}` : 'Select a parameter to map MIDI controller'}
              </span>
            </div>
            <button onClick={() => { setIsLearnModeActive(false); setLearningParam(null); }} className="text-amber-500 hover:text-amber-400">
               <X size={12} />
            </button>
          </div>
        )}

        {/* CONTROLS SECTION */}
        <div className="shrink-0 bg-zinc-900/20 border-b border-zinc-800/50 py-2 z-30">
          <div className="flex items-center gap-4 px-4 mb-1">
            <div className="flex items-center gap-1.5 shrink-0">
              <Layers size={12} className="text-cyan-500" />
              <span className="text-[10px] font-black uppercase text-zinc-500 mono">{presetName}</span>
            </div>
            
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar py-1">
              {Object.keys(ENVELOPE_PRESETS).map(key => (
                <button 
                  key={key} 
                  onClick={() => setSettings(p => ({...p, envelope: ENVELOPE_PRESETS[key].settings}))} 
                  className="px-2 py-0.5 bg-zinc-950 rounded text-[7px] font-bold uppercase text-zinc-600 hover:text-cyan-400 border border-zinc-800 whitespace-nowrap"
                >
                  {key}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <span className="text-[8px] font-black uppercase text-zinc-700 mono hidden sm:inline">Fine Tune</span>
              <input 
                type="range" min="-100" max="100" value={settings.masterTune} 
                onChange={(e) => setSettings(p => ({...p, masterTune: parseInt(e.target.value)}))}
                className="w-16 sm:w-20 accent-cyan-500"
              />
            </div>
          </div>
          
          <div className="px-1 overflow-x-auto no-scrollbar">
            <Controls 
              settings={settings} 
              setSettings={setSettings} 
              lang={lang} 
              isLearnMode={isLearnModeActive}
              learningParam={learningParam}
              setLearningParam={setLearningParam}
              midiMappings={midiMappings}
            />
          </div>
        </div>

        {/* KEYBOARD AREA (ALWAYS ACCESSIBLE AT THE BOTTOM) */}
        <div className="flex-1 min-h-0 relative flex flex-col">
          <div className="flex-1 relative z-10">
            <Keyboard onNoteStart={handleNoteStart} onNoteEnd={handleNoteEnd} settings={settings} />
          </div>
        </div>
      </div>

      {/* MORE MENU MODAL */}
      {isMoreMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-4 border-b border-zinc-900 flex justify-between items-center bg-zinc-950/50">
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                <Settings size={16} className="text-cyan-500" /> Advanced Control Center
              </h2>
              <button onClick={() => setIsMoreMenuOpen(false)} className="text-zinc-500 hover:text-white p-1">
                <X size={24} />
              </button>
            </div>

            <div className="overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-2 gap-8 no-scrollbar">
              <div className="flex flex-col gap-8">
                <section>
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest flex items-center gap-2"><Cpu size={14}/> {t.savedPresets}</h3>
                    <button 
                      onClick={() => setIsSaving(!isSaving)} 
                      className="flex items-center gap-1.5 text-[10px] font-black text-cyan-400 bg-cyan-950/30 border border-cyan-900/50 px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                    >
                      <Save size={14} /> {t.savePreset}
                    </button>
                  </div>

                  {isSaving && (
                    <div className="mb-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl shadow-inner">
                      <input 
                        autoFocus placeholder={t.presetNameLabel}
                        value={saveName} onChange={(e) => setSaveName(e.target.value)}
                        className="w-full bg-transparent border-b border-zinc-800 p-2 text-sm text-cyan-400 focus:outline-none focus:border-cyan-500 mb-4 font-bold"
                      />
                      <div className="flex gap-2">
                        <button onClick={handleSaveCurrent} className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-black text-[10px] font-black py-2.5 rounded-lg transition-colors uppercase"> {t.save} </button>
                        <button onClick={() => setIsSaving(false)} className="flex-1 bg-zinc-800 text-zinc-300 text-[10px] font-black py-2.5 rounded-lg transition-colors uppercase"> {t.cancel} </button>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                    {savedPresets.length === 0 ? (
                      <div className="py-10 text-center text-zinc-700 text-[10px] border border-dashed border-zinc-900 rounded-xl uppercase font-black">
                        {t.emptyLibrary}
                      </div>
                    ) : (
                      savedPresets.map(p => (
                        <div key={p.id} onClick={() => loadPreset(p)} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800 hover:border-cyan-900 transition-all cursor-pointer group">
                          <span className="text-[10px] font-bold text-zinc-400 group-hover:text-cyan-300 truncate">{p.name}</span>
                          <button onClick={(e) => { e.stopPropagation(); setSavedPresets(prev => prev.filter(item => item.id !== p.id)); }} className="text-zinc-700 hover:text-red-500 transition-colors p-1">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </section>

                <div className="grid grid-cols-2 gap-4">
                  <section>
                    <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Globe size={14}/> Language</h3>
                    <div className="flex gap-2">
                      <button onClick={() => setLang('en')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black border transition-all ${lang === 'en' ? 'bg-cyan-600 text-black border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>ENGLISH</button>
                      <button onClick={() => setLang('zh')} className={`flex-1 py-2.5 rounded-xl text-[10px] font-black border transition-all ${lang === 'zh' ? 'bg-cyan-600 text-black border-cyan-500 shadow-lg shadow-cyan-900/20' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>中文</button>
                    </div>
                  </section>
                  <section>
                    <h3 className="text-[10px] font-black text-zinc-600 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Monitor size={14}/> Device</h3>
                    <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800 text-[10px] font-black flex justify-between items-center">
                        <span className="text-zinc-500 uppercase">Midi Ready</span>
                        <span className={midiEnabled ? 'text-cyan-500' : 'text-zinc-700'}>{midiEnabled ? 'YES' : 'NO'}</span>
                    </div>
                  </section>
                </div>
              </div>

              <section className="bg-zinc-900/20 p-4 rounded-2xl border border-zinc-800/50">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-[10px] font-black text-zinc-400 uppercase tracking-widest flex items-center gap-2">
                    <Link size={14} className="text-cyan-500" /> Mapping Overview
                  </h3>
                  <button onClick={() => setMidiMappings({})} className="text-[8px] font-black text-red-500 hover:text-red-400 uppercase tracking-tighter">Clear All</button>
                </div>

                <div className="grid grid-cols-1 gap-2 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                  {Object.keys(midiMappings).length === 0 ? (
                    <div className="py-8 text-center text-[10px] text-zinc-700 font-black uppercase">No active mappings</div>
                  ) : (
                    Object.entries(midiMappings).map(([cc, path]) => (
                      <div key={cc} className="flex items-center justify-between p-3 bg-zinc-900 border border-zinc-800/50 rounded-xl">
                        <div className="flex flex-col">
                          <span className="text-[9px] font-black text-zinc-100 uppercase mono">{MAPPABLE_PARAMS.find(p => p.id === path)?.label || path}</span>
                          <span className="text-[7px] text-zinc-500 uppercase tracking-widest">Linked to CC {cc}</span>
                        </div>
                        <button onClick={() => setMidiMappings(prev => { const n = {...prev}; delete n[parseInt(cc)]; return n; })} className="text-zinc-700 hover:text-red-500 transition-colors p-1">
                          <Trash2 size={12}/>
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
