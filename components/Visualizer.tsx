
import React, { useEffect, useRef } from 'react';
import { audioEngine } from '../services/audioEngine';
import { SynthSettings } from '../types';

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

      // Effect-driven trail
      const trailOpacity = 0.2 + (settings.reverb * 0.1);
      ctx.fillStyle = `rgba(0, 0, 0, ${1 - trailOpacity})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const barWidth = (canvas.width / (bufferLength / 4));
      let x = 0;

      const brightness = 50 + (settings.filter.frequency / 200);
      const saturation = 60 + (settings.filter.resonance * 1.5);

      for (let i = 0; i < bufferLength / 4; i++) {
        const value = dataArray[i];
        const percent = value / 255;
        const barHeight = percent * canvas.height;

        let hue = 190;
        switch (settings.waveform) {
          case 'square': hue = 10; break;
          case 'sawtooth': hue = 40; break;
          case 'triangle': hue = 280; break;
        }

        ctx.fillStyle = `hsla(${hue}, ${saturation}%, ${brightness}%, ${0.4 + percent * 0.6})`;
        
        if (settings.waveform === 'square') {
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        } else {
          ctx.beginPath();
          ctx.roundRect(x, canvas.height - barHeight, barWidth - 1, barHeight, [2, 2, 0, 0]);
          ctx.fill();
        }

        if (percent > 0.2) {
          ctx.fillStyle = `hsla(${hue}, 100%, 80%, ${percent * 0.5})`;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, 1);
        }

        x += barWidth;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, [settings]);

  return (
    <div className="w-full h-full bg-black flex items-center justify-center overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full opacity-80" width={300} height={40} />
    </div>
  );
};

export default Visualizer;
