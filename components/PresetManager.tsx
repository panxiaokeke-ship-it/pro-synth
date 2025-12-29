
import React, { useState, useRef, useEffect } from 'react';
import { StoredPreset, SynthSettings, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { 
  ChevronDown, Save, Trash2, FolderOpen, Plus, 
  Check, X, Zap, Download, Upload, Copy 
} from 'lucide-react';

interface PresetManagerProps {
  currentSettings: SynthSettings;
  onLoadPreset: (preset: StoredPreset) => void;
  savedPresets: StoredPreset[];
  onSavePreset: (name: string) => void;
  onDeletePreset: (id: string) => void;
  lang: Language;
  currentPresetName: string;
}

const PresetManager: React.FC<PresetManagerProps> = ({ 
  currentSettings, onLoadPreset, savedPresets, onSavePreset, onDeletePreset, lang, currentPresetName 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newName, setNewName] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const t = TRANSLATIONS[lang];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsSaving(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSave = () => {
    if (newName.trim()) {
      onSavePreset(newName.trim());
      setNewName("");
      setIsSaving(false);
    }
  };

  const exportPreset = (preset: StoredPreset) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(preset));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `${preset.name.replace(/\s+/g, '_')}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all duration-200 group ${isOpen ? 'bg-zinc-800 border-cyan-500/50 text-cyan-400' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'}`}
      >
        <FolderOpen size={14} className={isOpen ? 'text-cyan-400' : 'text-zinc-500'} />
        <div className="flex flex-col items-start leading-none pr-1">
          <span className="text-[7px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-500 mb-0.5">Preset</span>
          <span className="text-[10px] font-bold truncate max-w-[100px]">{currentPresetName}</span>
        </div>
        <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-[calc(100%+8px)] left-0 w-64 bg-zinc-950 border border-zinc-800 rounded-xl shadow-2xl z-[100] animate-in fade-in slide-in-from-top-2 overflow-hidden flex flex-col max-h-[400px]">
          <div className="p-3 bg-zinc-900/50 border-b border-zinc-800 flex items-center justify-between">
             <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Preset Library</span>
             <button 
              onClick={() => setIsSaving(true)}
              className="text-[8px] font-black text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition-colors"
             >
               <Plus size={10} /> Save New
             </button>
          </div>

          {isSaving && (
            <div className="p-3 border-b border-zinc-800 bg-cyan-950/10 animate-in slide-in-from-top-1 duration-200">
              <input 
                autoFocus
                placeholder="Name your sound..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                className="w-full bg-black/50 border border-zinc-800 rounded px-2 py-1.5 text-[10px] text-cyan-400 focus:outline-none focus:border-cyan-500 mb-2 font-bold"
              />
              <div className="flex gap-2">
                <button 
                  onClick={handleSave}
                  className="flex-1 bg-cyan-600 hover:bg-cyan-500 text-black text-[9px] font-black py-1.5 rounded transition-colors uppercase flex items-center justify-center gap-1"
                >
                  <Check size={10} /> Confirm
                </button>
                <button 
                  onClick={() => setIsSaving(false)}
                  className="flex-1 bg-zinc-800 text-zinc-300 text-[9px] font-black py-1.5 rounded transition-colors uppercase flex items-center justify-center gap-1"
                >
                  <X size={10} /> Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto no-scrollbar py-1">
            {savedPresets.length === 0 ? (
              <div className="py-8 text-center px-4">
                <p className="text-[9px] font-bold text-zinc-700 uppercase leading-relaxed tracking-wider">
                  No user presets found.<br/>Save your current settings!
                </p>
              </div>
            ) : (
              savedPresets.map((preset) => (
                <div 
                  key={preset.id}
                  className={`group flex items-center justify-between px-3 py-2 transition-all cursor-pointer border-l-2 ${currentPresetName === preset.name ? 'bg-cyan-900/10 border-cyan-500' : 'hover:bg-zinc-900/50 border-transparent hover:border-zinc-700'}`}
                  onClick={() => {
                    onLoadPreset(preset);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex flex-col min-w-0 flex-1">
                    <span className={`text-[10px] font-bold truncate ${currentPresetName === preset.name ? 'text-cyan-400' : 'text-zinc-300'}`}>
                      {preset.name}
                    </span>
                    <span className="text-[7px] text-zinc-600 uppercase mono font-medium">
                      {new Date(preset.timestamp).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={(e) => { e.stopPropagation(); exportPreset(preset); }}
                      className="p-1.5 text-zinc-600 hover:text-zinc-400"
                      title="Export JSON"
                    >
                      <Download size={10} />
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); onDeletePreset(preset.id); }}
                      className="p-1.5 text-zinc-700 hover:text-red-500"
                      title="Delete Preset"
                    >
                      <Trash2 size={10} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
          
          <div className="p-2 border-t border-zinc-900 bg-black/40 flex items-center justify-between">
             <div className="flex items-center gap-1 text-[7px] text-zinc-600 uppercase font-black">
               <Zap size={8} /> 
               <span>Auto-Sync Active</span>
             </div>
             <label className="cursor-pointer text-[8px] font-black text-zinc-500 hover:text-white transition-colors flex items-center gap-1">
               <Upload size={10} /> Import
               <input 
                type="file" 
                className="hidden" 
                accept=".json"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      try {
                        const preset = JSON.parse(event.target?.result as string);
                        onLoadPreset(preset);
                        onSavePreset(preset.name + " (Import)");
                        setIsOpen(false);
                      } catch (err) {
                        alert("Invalid preset file.");
                      }
                    };
                    reader.readAsText(file);
                  }
                }}
               />
             </label>
          </div>
        </div>
      )}
    </div>
  );
};

export default PresetManager;
