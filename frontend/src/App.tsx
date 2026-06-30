import { useState, useEffect } from 'react';
import { Settings, Cpu, Radio, Zap } from 'lucide-react';
import LocationPanel from './components/LocationPanel';
import NewsPanel from './components/NewsPanel';
import NeuralSphere from './components/NeuralSphere';
import SystemStatus from './components/SystemStatus';
import AudioVisualizer from './components/AudioVisualizer';
import AgentConsole from './components/AgentConsole';
import ChatPanel from './components/ChatPanel';
import VoiceTranscriptBox from './components/VoiceTranscriptBox';

type AgentStatus = 'idle' | 'listening' | 'processing' | 'speaking' | 'executing';

const STATUS_COLORS: Record<AgentStatus, string> = {
  idle:       '#ff7b00',
  listening:  '#f43f5e',
  processing: '#f59e0b',
  speaking:   '#ff9d3f',
  executing:  '#00d4ff',
};

const STATUS_LABELS: Record<AgentStatus, string> = {
  idle:       'STANDBY',
  listening:  'LISTENING',
  processing: 'PROCESSING',
  speaking:   'VOCALIZING',
  executing:  'AGENT ACTIVE',
};

export default function App() {
  const [city, setCity] = useState('Hyderabad');
  const [voiceStatus, setVoiceStatus] = useState<AgentStatus>('idle');
  const [speakerActive, setSpeakerActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [time, setTime] = useState(new Date());

  // ── Pending command lifted from VoiceTranscriptBox to AgentConsole ──
  const [pendingCommand, setPendingCommand] = useState('');

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClock = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

  const formatDate = (d: Date) =>
    d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase();

  const statusColor = STATUS_COLORS[voiceStatus];
  const isAgentMode = voiceStatus === 'executing';

  // When user submits from transcript box → forward to AgentConsole
  const handleTranscriptSubmit = (text: string) => {
    setPendingCommand(text);
    setLiveTranscript('');
    setInterimTranscript('');
  };

  const handleClearTranscript = () => {
    setLiveTranscript('');
    setInterimTranscript('');
  };

  return (
    <div
      className="flex flex-col h-screen w-screen overflow-hidden bg-black text-white p-3 select-none"
      style={{ fontFamily: 'var(--font-ui)' }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="flex-shrink-0 flex justify-between items-center hud-panel px-5 py-2.5 mb-3 relative overflow-hidden"
        style={{ borderColor: statusColor + '40' }}>
        <div className="absolute inset-0 scan-line pointer-events-none" />

        {/* Left: Brand */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="relative">
            <Cpu
              size={18}
              className="animate-pulse"
              style={{ color: statusColor }}
            />
            {isAgentMode && (
              <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-[var(--clr-agent)] animate-ping" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm tracking-[0.2em] font-extrabold text-white">NEURAL OS</span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.5 rounded border"
                style={{ color: statusColor, borderColor: statusColor + '50', background: statusColor + '15' }}
              >
                v2.0
              </span>
            </div>
            <span className="text-[9px] font-mono text-white/25 tracking-widest">AUTONOMOUS AGENT SYSTEM</span>
          </div>
        </div>

        {/* Center: Status */}
        <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full animate-pulse"
            style={{ background: statusColor, boxShadow: `0 0 8px ${statusColor}` }}
          />
          <span
            className="text-[10px] font-mono font-bold tracking-widest"
            style={{ color: statusColor }}
          >
            {STATUS_LABELS[voiceStatus]}
          </span>
        </div>

        {/* Right: Controls */}
        <div className="flex items-center gap-4 text-xs font-mono relative z-10">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px]"
            style={{ color: statusColor, borderColor: statusColor + '40', background: statusColor + '10' }}>
            <Radio size={10} className="animate-pulse" />
            <span>LIVE TELEMETRY</span>
          </div>

          <div className="text-right">
            <div className="text-white font-bold text-sm">{formatClock(time)}</div>
            <div className="text-white/30 text-[9px]">{formatDate(time)}</div>
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="flex items-center gap-1 text-[9px] text-white/30">
              <Zap size={10} className="text-[var(--clr-agent)]" />
              <span className="text-[var(--clr-agent)]">AGENT READY</span>
            </div>
            <button className="text-gray-400 hover:text-[var(--clr-accent)] transition-colors" title="System Settings">
              <Settings size={13} />
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Grid ──────────────────────────────────────────────────── */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-[290px_1fr_360px] gap-3 overflow-hidden min-h-0">

        {/* Left Column: Location, News */}
        <section className="flex flex-col gap-3 overflow-hidden h-full">
          <LocationPanel onLocationUpdate={setCity} />
          <NewsPanel city={city} />
        </section>

        {/* Center Column: Neural Sphere + Voice Transcript Box + Audio Visualizer */}
        <section className="flex flex-col justify-between items-stretch overflow-hidden h-full rounded-xl border border-white/5 bg-black/30 p-2 relative">
          {/* Corner decorations */}
          <div className="absolute top-0 left-0 w-8 h-8 border-t border-l rounded-tl-xl pointer-events-none"
            style={{ borderColor: statusColor + '40' }} />
          <div className="absolute bottom-0 right-0 w-8 h-8 border-b border-r rounded-br-xl pointer-events-none"
            style={{ borderColor: statusColor + '40' }} />

          {/* 3D Neural Sphere */}
          <div className="flex-grow flex items-center justify-center min-h-0">
            <NeuralSphere status={voiceStatus} />
          </div>

          {/* Voice Transcript Box — live speech display + editable */}
          <div className="px-1 pb-1">
            <VoiceTranscriptBox
              interimText={interimTranscript}
              finalText={liveTranscript}
              isListening={voiceStatus === 'listening'}
              onSubmit={handleTranscriptSubmit}
              onClear={handleClearTranscript}
              disabled={voiceStatus === 'executing' || voiceStatus === 'processing'}
            />
          </div>

          {/* Audio Visualizer */}
          <AudioVisualizer
            status={voiceStatus}
            onStatusChange={setVoiceStatus}
            onSpeechTranscript={setLiveTranscript}
            onInterimTranscript={setInterimTranscript}
          />
        </section>

        {/* Right Column: Chat + System Diagnostics + Agent Console */}
        <section className="flex flex-col gap-3 overflow-hidden h-full">
          <div className="flex-1 min-h-0">
            <ChatPanel city={city} />
          </div>
          <SystemStatus voiceActive={speakerActive} />
          <AgentConsole
            city={city}
            onStatusChange={setVoiceStatus}
            onSpeakerStateChange={setSpeakerActive}
            transcript={pendingCommand || liveTranscript}
            onClearTranscript={() => setPendingCommand('')}
          />
        </section>
      </main>
    </div>
  );
}
