
import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { SynthSettings, WaveformType } from '../types';

interface VisualizerProps {
  settings: SynthSettings;
}

const Visualizer: React.FC<VisualizerProps> = ({ settings }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const analyzer = audioEngine.getAnalyzer();

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      if (!analyzer) return;

      const bufferLength = analyzer.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyzer.getByteFrequencyData(dataArray);

      // Effect-driven trail: Reverb and Delay settings influence how much of the previous frame remains
      const trailOpacity = 0.15 + (settings.reverb * 0.2) + (settings.delay * 0.1);
      ctx.fillStyle = `rgba(10, 10, 12, ${1 - trailOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / (bufferLength / 2));
      let x = 0;

      // Filter cutoff influences color brightness/saturation
      const brightness = Math.min(100, 30 + (settings.filter.frequency / 150));
      const saturation = 50 + (settings.filter.resonance * 2);

      for (let i = 0; i < bufferLength / 2; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * canvas.height;

        // Base color determined by waveform
        let hue = 0;
        switch (settings.waveform) {
          case 'sine':
            hue = 190 + (i / bufferLength) * 40; // Cyan/Blue
            break;
          case 'square':
            hue = 0 + (i / bufferLength) * 30; // Red/Orange
            break;
          case 'sawtooth':
            hue = 45 + (i / bufferLength) * 50; // Yellow/Amber
            break;
          case 'triangle':
            hue = 280 + (i / bufferLength) * 60; // Purple/Magenta
            break;
        }

        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${brightness}%, ${0.3 + percent * 0.7})`;
        
        // Drawing style shifts with waveform
        if (settings.waveform === 'square') {
          // Sharp blocks for square wave
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        } else if (settings.waveform === 'sine') {
          // Rounded, smooth bars for sine wave
          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, barWidth - 1, barHeight, [4, 4, 0, 0]);
          ctx.fill();
        } else {
          // Default jagged bars
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        }

        // Add a highlight glow at the top of each bar
        if (percent > 0.1) {
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${percent})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, 2);
        }

        x += barWidth;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [settings]);

  return (
    <div className="w-full h-32 bg-black/40 rounded-xl overflow-hidden border border-zinc-800 shadow-inner">
      <canvas ref={canvasRef} className="w-full h-full" width={800} height={128} />
    </div>
  );
};

export default Visualizer;
