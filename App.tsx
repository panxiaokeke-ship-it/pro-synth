
import React, { useState, useEffect, useCallback } from 'react';
import { DEFAULT_SETTINGS, midiNoteToFrequency, getNoteLabel, TRANSLATIONS } from './constants';
import { SynthSettings, NoteEvent, EnvelopeSettings, StoredPreset, Language } from './types';
import { audioEngine } from './services/audioEngine';
import Visualizer from './components/Visualizer';
import Controls from './components/Controls';
import Keyboard from './components/Keyboard';
import Looper from './components/Looper';
import { 
  Activity, Layers, Settings, X, Check, Globe, Monitor, Trash2, Save, Library
} from 'lucide-react';

const ENVELOPE_PRESETS: Record<string, { labelKey: keyof typeof TRANSLATIONS.en; settings: EnvelopeSettings }> = {
  fast: { labelKey: 'fastAttack', settings: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.3 } },
  slow: { labelKey: 'slowAttack', settings: { attack: 1.2, decay: 0.4, sustain: 0.7, release: 1.5 } },
  sustained: { labelKey: 'sustained', settings: { attack: 0.2, decay: 0.2, sustain: 1.0, release: 0.8 } },
  quick: { labelKey: 'quickRelease', settings: { attack: 0.05, decay: 0.1, sustain: 0.2, release: 0.05 } }
};

const STORAGE_KEY = 'gemini_synth_presets_v3';
const LANG_STORAGE_KEY = 'gemini_synth_lang';

const App: React.FC = () => {
  const [lang, setLang] = useState<Language>(() => (localStorage.getItem(LANG_STORAGE_KEY) as Language) || 'zh');
  const [settings, setSettings] = useState<SynthSettings>(DEFAULT_SETTINGS);
  const [presetName, setPresetName] = useState("Default Lead");
  const [lastNoteEvents, setLastNoteEvents] = useState<NoteEvent[]>([]);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const [savedPresets, setSavedPresets] = useState<StoredPreset[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveName, setSaveName] = useState("");

  const t = TRANSLATIONS[lang];

  useEffect(() => { localStorage.setItem(LANG_STORAGE_KEY, lang); }, [lang]);
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) try { setSavedPresets(JSON.parse(raw)); } catch (e) { console.error(e); }
  }, []);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(savedPresets)); }, [savedPresets]);
  useEffect(() => { audioEngine.updateSettings(settings); }, [settings]);

  const handleNoteStart = useCallback((note: string, freq: number) => {
    audioEngine.playNote(freq, note, settings);
    setLastNoteEvents(prev => [...prev, { note, frequency: freq, timestamp: Date.now(), startTime: Date.now() }]);
  }, [settings]);

  const handleNoteEnd = useCallback((note: string) => {
    audioEngine.stopNote(note, settings);
  }, [settings]);

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
    setIsSettingsOpen(false);
  };

  useEffect(() => {
    if (!navigator.requestMIDIAccess) return;
    const onMIDISuccess = (midiAccess: any) => {
      setMidiEnabled(true);
      midiAccess.inputs.forEach((input: any) => {
        input.onmidimessage = (message: any) => {
          const [status, note, velocity] = message.data;
          const command = status & 0xF0;
          if (command === 0x90 && velocity > 0) handleNoteStart(getNoteLabel(note), midiNoteToFrequency(note));
          else if (command === 0x80 || (command === 0x90 && velocity === 0)) handleNoteEnd(getNoteLabel(note));
        };
      });
    };
    navigator.requestMIDIAccess().then(onMIDISuccess, () => setMidiEnabled(false));
  }, [handleNoteStart, handleNoteEnd]);

  return (
    <div className="h-screen w-screen bg-black text-zinc-200 flex flex-col overflow-hidden select-none touch-none">
      {/* 1. Header & Looper Dashboard (Slim) */}
      <header className="h-10 px-2 flex items-center border-b border-zinc-900 bg-black shrink-0 z-50 gap-2">
        <div className="flex items-center gap-1.5 shrink-0 px-2 border-r border-zinc-900 h-full">
          <Activity size={14} className="text-cyan-500" />
          <span className="text-[10px] font-black uppercase text-white truncate max-w-[80px] hidden sm:block tracking-widest">PRO SYNTH</span>
        </div>

        <div className="flex-1 h-full overflow-hidden">
          <Looper currentNotes={lastNoteEvents} settings={settings} onPlayEvent={handleNoteStart} onStopEvent={handleNoteEnd} lang={lang} />
        </div>

        <div className="flex items-center gap-2 shrink-0 h-full border-l border-zinc-900 px-2">
          <div className="w-16 h-7 rounded border border-zinc-900 overflow-hidden bg-zinc-950/50">
            <Visualizer settings={settings} />
          </div>
          <button 
            onClick={() => setIsSettingsOpen(true)} 
            className="p-1.5 bg-zinc-900 rounded border border-zinc-800 text-zinc-500 hover:text-cyan-400 active:bg-cyan-500 active:text-black transition-colors"
          >
            <Settings size={14}/>
          </button>
        </div>
      </header>

      {/* 2. Synthesis Dashboard (Compact) */}
      <section className="shrink-0 bg-[#070708] border-b border-zinc-900/60 pb-1 pt-0.5">
        <div className="flex items-center gap-2 px-3 h-5 mb-0.5">
          <Layers size={10} className="text-cyan-500 opacity-40" />
          <span className="text-[7px] font-black uppercase text-zinc-600 tracking-widest truncate">
            {t.synthesisEngine} <span className="text-zinc-500">[{presetName}]</span>
          </span>
          <div className="flex gap-1 ml-auto">
            {Object.keys(ENVELOPE_PRESETS).map(key => (
              <button 
                key={key} 
                onClick={() => setSettings(p => ({...p, envelope: ENVELOPE_PRESETS[key].settings}))} 
                className="px-1.5 py-0.5 bg-black rounded text-[6px] font-bold uppercase text-zinc-600 hover:text-cyan-400 border border-zinc-800 active:border-cyan-500"
              >
                {key}
              </button>
            ))}
          </div>
        </div>
        <Controls settings={settings} setSettings={setSettings} lang={lang} />
      </section>

      {/* 3. Primary Keyboard Display (Maximized) */}
      <main className="flex-1 min-h-0 bg-black flex flex-col relative">
        <Keyboard onNoteStart={handleNoteStart} onNoteEnd={handleNoteEnd} settings={settings} />
      </main>

      {/* Unified Library & Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-md">
          <div className="bg-zinc-950 border border-zinc-800 w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
            <div className="p-3 border-b border-zinc-900 flex justify-between items-center bg-black/40">
              <h2 className="text-[10px] font-black uppercase tracking-widest text-zinc-300 flex items-center gap-2">
                <Library size={14} className="text-cyan-500" /> {t.presetLibrary}
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="text-zinc-500 hover:text-white p-2">
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto p-4 flex flex-col gap-6 custom-scrollbar">
              <section>
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-[9px] font-black text-zinc-600 uppercase">Saved Sounds</h3>
                  <button 
                    onClick={() => setIsSaving(!isSaving)} 
                    className="flex items-center gap-1.5 text-[9px] font-black text-cyan-500 border border-cyan-500/20 px-3 py-1 rounded-full uppercase active:bg-cyan-500 active:text-black transition-all"
                  >
                    <Save size={10} /> {t.savePreset}
                  </button>
                </div>

                {isSaving && (
                  <div className="mb-4 p-4 bg-zinc-900/50 border border-zinc-800 rounded-xl animate-in fade-in slide-in-from-top-2">
                    <input 
                      autoFocus placeholder={t.presetNameLabel}
                      value={saveName} onChange={(e) => setSaveName(e.target.value)}
                      className="w-full bg-black border border-zinc-800 p-2.5 rounded-lg text-sm text-cyan-400 focus:outline-none focus:border-cyan-500 mb-3 font-medium"
                    />
                    <div className="flex gap-2">
                      <button onClick={handleSaveCurrent} className="flex-1 bg-cyan-500 text-black text-[10px] font-bold py-2 rounded-lg flex items-center justify-center gap-1">
                        <Check size={14} /> {t.save}
                      </button>
                      <button onClick={() => setIsSaving(false)} className="flex-1 bg-zinc-800 text-white text-[10px] font-bold py-2 rounded-lg">
                        {t.cancel}
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  {savedPresets.length === 0 ? (
                    <div className="col-span-2 py-10 text-center text-zinc-800 text-[9px] border border-dashed border-zinc-900 rounded-xl uppercase font-black tracking-widest">
                      {t.emptyLibrary}
                    </div>
                  ) : (
                    savedPresets.map(p => (
                      <div key={p.id} onClick={() => loadPreset(p)} className="flex items-center justify-between p-3 rounded-xl bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/50 hover:border-cyan-500/30 transition-all cursor-pointer group">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-bold text-zinc-300 group-hover:text-cyan-400 truncate">{p.name}</span>
                          <span className="text-[7px] text-zinc-600 uppercase">{new Date(p.timestamp).toLocaleDateString()}</span>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); setSavedPresets(prev => prev.filter(item => item.id !== p.id)); }} className="p-1.5 text-zinc-800 hover:text-red-500 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div className="grid grid-cols-2 gap-4">
                <section>
                  <h3 className="text-[9px] font-black text-zinc-600 uppercase mb-2 flex items-center gap-1"><Globe size={12}/> {lang === 'zh' ? '语言' : 'Language'}</h3>
                  <div className="flex gap-1">
                    <button onClick={() => setLang('en')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border ${lang === 'en' ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>EN</button>
                    <button onClick={() => setLang('zh')} className={`flex-1 py-1.5 rounded-lg text-[10px] font-bold border ${lang === 'zh' ? 'bg-cyan-500 text-black border-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>中文</button>
                  </div>
                </section>
                <section>
                   <h3 className="text-[9px] font-black text-zinc-600 uppercase mb-2 flex items-center gap-1"><Monitor size={12}/> {t.midiStatus}</h3>
                   <div className={`p-2 bg-black/40 rounded-lg border border-zinc-900 text-[9px] font-bold flex justify-between items-center ${midiEnabled ? 'text-cyan-500' : 'text-zinc-800'}`}>
                      <span>{midiEnabled ? 'ACTIVE' : 'OFFLINE'}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${midiEnabled ? 'bg-cyan-500 animate-pulse' : 'bg-zinc-800'}`} />
                   </div>
                </section>
              </div>
            </div>
            <div className="p-3 bg-black/40 text-[7px] text-zinc-800 text-center border-t border-zinc-900 uppercase font-black">
              Local Storage Interface v2.5 • No External Servers
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
