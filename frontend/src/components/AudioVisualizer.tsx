import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Loader2 } from 'lucide-react';

interface AudioVisualizerProps {
  status: 'idle' | 'listening' | 'processing' | 'speaking' | 'executing';
  onStatusChange: (status: 'idle' | 'listening' | 'processing' | 'speaking' | 'executing') => void;
  /** Fires with final confirmed transcript text */
  onSpeechTranscript: (text: string) => void;
  /** Fires continuously with live interim text while user speaks */
  onInterimTranscript?: (text: string) => void;
}

export default function AudioVisualizer({
  status,
  onStatusChange,
  onSpeechTranscript,
  onInterimTranscript,
}: AudioVisualizerProps) {
  const [recognitionActive, setRecognitionActive] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);
  const animationIdRef = useRef<number | null>(null);
  const interimRef = useRef('');

  // Initialize Speech Recognition — continuous + interimResults ON
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      console.warn('Browser does not support SpeechRecognition API.');
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;      // keep listening after each phrase
    rec.interimResults = true;  // stream partial results
    rec.lang = 'en-US';
    rec.maxAlternatives = 1;

    rec.onstart = () => {
      setRecognitionActive(true);
      onStatusChange('listening');
      startAudioAnalysis();
    };

    rec.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += result[0].transcript;
        } else {
          interimTranscript += result[0].transcript;
        }
      }

      // Stream live interim text
      if (interimTranscript) {
        interimRef.current = interimTranscript;
        onInterimTranscript?.(interimTranscript);
      }

      // Commit final text
      if (finalTranscript.trim()) {
        interimRef.current = '';
        onInterimTranscript?.('');
        onSpeechTranscript(finalTranscript.trim());
      }
    };

    rec.onerror = (e: any) => {
      console.error('Speech recognition error:', e.error);
      stopAudioAnalysis();
      onStatusChange('idle');
      setRecognitionActive(false);
      interimRef.current = '';
      onInterimTranscript?.('');
    };

    rec.onend = () => {
      stopAudioAnalysis();
      setRecognitionActive(false);
      interimRef.current = '';
      onInterimTranscript?.('');
      if (status === 'listening') {
        onStatusChange('idle');
      }
    };

    recognitionRef.current = rec;
    drawIdleWave();

    return () => {
      if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
      stopAudioAnalysis();
    };
  }, [status]); // eslint-disable-line

  // ── Audio analysis helpers ─────────────────────────────────────────
  const startAudioAnalysis = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      audioContextRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      drawActiveWave();
    } catch (err) {
      console.error('Error accessing microphone for visualizer:', err);
      drawIdleWave();
    }
  };

  const stopAudioAnalysis = () => {
    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioContextRef.current) audioContextRef.current.close();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    audioContextRef.current = null;
    analyserRef.current = null;
    dataArrayRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    drawIdleWave();
  };

  // ── Canvas drawing ─────────────────────────────────────────────────
  const drawActiveWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const dataArray = dataArrayRef.current;
    if (!ctx || !analyser || !dataArray) return;

    const w = canvas.width;
    const h = canvas.height;
    const bufferLength = analyser.frequencyBinCount;

    const draw = () => {
      animationIdRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(dataArray as any);

      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      // Reference mid-line
      ctx.strokeStyle = 'rgba(255, 123, 0, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      // Oscilloscope wave
      ctx.strokeStyle = '#ff7b00';
      ctx.lineWidth = 2.5;
      ctx.shadowBlur = 14;
      ctx.shadowColor = '#ff7b00';
      ctx.beginPath();

      const sliceWidth = w / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * h) / 2;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
        x += sliceWidth;
      }
      ctx.lineTo(w, h / 2);
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Overlay interim text on the canvas
      const interim = interimRef.current;
      if (interim) {
        const maxLen = 55;
        const label = interim.length > maxLen ? '…' + interim.slice(-maxLen) : interim;
        ctx.font = '11px JetBrains Mono, monospace';
        ctx.fillStyle = 'rgba(244, 63, 94, 0.85)';
        ctx.shadowBlur = 6;
        ctx.shadowColor = 'rgba(244,63,94,0.4)';
        ctx.fillText(label, 10, h - 8);
        ctx.shadowBlur = 0;
      }
    };

    draw();
  };

  const drawIdleWave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    let phase = 0;

    const draw = () => {
      animationIdRef.current = requestAnimationFrame(draw);
      ctx.fillStyle = '#0a0a0f';
      ctx.fillRect(0, 0, w, h);

      ctx.strokeStyle = 'rgba(255, 123, 0, 0.05)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h / 2);
      ctx.lineTo(w, h / 2);
      ctx.stroke();

      ctx.strokeStyle = 'rgba(255, 123, 0, 0.25)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();

      phase += 0.02;
      const amplitude = status === 'speaking' ? 15 : 4;
      const frequency = status === 'speaking' ? 0.08 : 0.03;

      for (let x = 0; x < w; x++) {
        const y = h / 2 + Math.sin(x * frequency + phase) * amplitude * Math.sin(x * 0.005);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    };

    if (animationIdRef.current) cancelAnimationFrame(animationIdRef.current);
    draw();
  };

  const toggleMicrophone = () => {
    if (!recognitionRef.current) {
      alert(
        'Speech recognition API is not supported in this browser. Please use Google Chrome or Microsoft Edge.'
      );
      return;
    }
    if (recognitionActive) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'listening':   return 'LISTENING — SPEAK NOW...';
      case 'processing':  return 'COGNITIVE CORRELATION IN PROGRESS...';
      case 'speaking':    return 'VOCALIZING RESPONSE DATA...';
      case 'executing':   return 'AGENT EXECUTING TASK...';
      default:            return 'UPLINK ACTIVE — STANDBY';
    }
  };

  return (
    <div className="hud-panel p-4 flex items-center justify-between gap-4 mt-2">
      {/* Microphone toggle */}
      <button
        onClick={toggleMicrophone}
        disabled={status === 'processing' || status === 'executing'}
        title={recognitionActive ? 'Stop listening' : 'Start listening'}
        className={`h-14 w-14 rounded-full flex items-center justify-center border transition-all duration-300 flex-shrink-0 ${
          recognitionActive
            ? 'bg-rose-600/20 border-rose-500 hover:bg-rose-600/30 text-rose-500 animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.3)]'
            : status === 'processing' || status === 'executing'
            ? 'bg-[#ff7b00]/5 border-orange-500/30 text-gray-500 cursor-not-allowed'
            : 'bg-[#ff7b00]/10 border-orange-500/30 hover:border-[#ff7b00] text-[#ff7b00] hover:bg-[#ff7b00]/25'
        }`}
      >
        {status === 'processing' || status === 'executing' ? (
          <Loader2 size={24} className="animate-spin text-[#ff7b00]" />
        ) : recognitionActive ? (
          <Mic size={24} />
        ) : (
          <MicOff size={24} />
        )}
      </button>

      {/* Waveform canvas */}
      <div className="flex-grow h-14 border border-orange-500/10 rounded-lg overflow-hidden relative">
        <canvas ref={canvasRef} width={400} height={56} className="w-full h-full block bg-[#0a0a0f]" />
        <div className="absolute top-1.5 left-2 text-[8px] font-mono text-gray-600 tracking-wider">
          WAVEFORM ANALYSIS: {status.toUpperCase()}
        </div>
      </div>

      {/* Status text */}
      <div className="flex flex-col gap-0.5 w-48 hidden md:flex font-mono select-none">
        <span className="text-[8px] text-gray-500 tracking-widest uppercase">System State</span>
        <span className="text-[10px] text-[#ff7b00] font-bold tracking-wide truncate">
          {getStatusText()}
        </span>
      </div>
    </div>
  );
}
