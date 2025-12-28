
import { GoogleGenAI } from "@google/genai";
import { SynthSettings } from "../types";

export const generatePresetName = async (settings: SynthSettings): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const prompt = `Based on these synthesizer settings, generate a creative and cool 2-3 word name for the sound preset.
    Waveform: ${settings.waveform}
    Filter Cutoff: ${settings.filter.frequency}Hz
    Attack: ${settings.envelope.attack}s
    Release: ${settings.envelope.release}s
    Effect levels (Reverb/Delay): ${settings.reverb}/${settings.delay}
    Return ONLY the name.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });

    return response.text || "New Preset";
  } catch (error) {
    console.error("Gemini failed:", error);
    return "Cyber Synth";
  }
};

export const getSoundCharacter = async (settings: SynthSettings): Promise<string> => {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const prompt = `Describe the sonic character of this synthesizer setting in one atmospheric sentence:
      ${JSON.stringify(settings)}`;
  
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
  
      return response.text || "A mysterious and evolving soundscape.";
    } catch (error) {
      return "An electronic pulse from the machine.";
    }
  };
