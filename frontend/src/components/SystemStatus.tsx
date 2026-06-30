import { useState, useEffect } from 'react';
import { Activity, Wifi, ShieldAlert, Cpu, Bot, Wrench } from 'lucide-react';

interface SystemStatusProps {
  voiceActive: boolean;
}

interface StatusData {
  gps: string;
  internet: string;
  api: string;
  voice: string;
  news: string;
  agent?: string;
  tools?: number;
  version?: string;
}

export default function SystemStatus({ voiceActive }: SystemStatusProps) {
  const [status, setStatus] = useState<StatusData>({
    gps: 'active',
    internet: 'connected',
    api: 'simulation_mode',
    voice: 'active',
    news: 'synchronized',
    agent: 'simulation_mode',
    tools: 0
  });

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchStatus = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/status');
      if (res.ok) setStatus(await res.json());
    } catch {}
  };

  const getIndicatorClass = (val: string) => {
    switch (val) {
      case 'active':
      case 'connected':
      case 'synchronized':
      case 'ready':
        return 'dot-active';
      case 'simulation_mode':
        return 'dot-warn';
      default:
        return 'dot-error';
    }
  };

  const getTextColor = (val: string) => {
    switch (val) {
      case 'active': case 'connected': case 'synchronized': case 'ready':
        return 'text-emerald-400';
      case 'simulation_mode':
        return 'text-amber-400';
      default:
        return 'text-rose-400';
    }
  };

  const rows = [
    { icon: <Wifi size={12} />, label: 'INTERNET', value: status.internet },
    { icon: <ShieldAlert size={12} />, label: 'GPS TELEMETRY', value: status.gps },
    { icon: <Cpu size={12} />, label: 'COGNITIVE CORE', value: status.api?.replace('_', ' ') },
    { icon: <Bot size={12} />, label: 'AGENT ENGINE', value: status.agent?.replace('_', ' ') || 'offline' },
    { icon: <Wrench size={12} />, label: 'TOOL REGISTRY', value: status.tools ? `${status.tools} TOOLS` : 'offline' },
    {
      icon: <Cpu size={12} />,
      label: 'VOICE SYNTHESIS',
      value: voiceActive ? 'speaking' : 'ready',
      pulse: voiceActive
    },
  ];

  return (
    <div className="hud-panel p-3 flex flex-col gap-2.5">
      <div className="flex justify-between items-center border-b border-[var(--clr-accent-dim)] pb-2">
        <h3 className="label-mono label-accent flex items-center gap-1.5">
          <Activity size={12} className="animate-pulse" />
          <span>DIAGNOSTICS</span>
        </h3>
        <span className="label-mono label-dim">{status.version || 'SYS_A.10'}</span>
      </div>

      <div className="flex flex-col gap-1.5">
        {rows.map(({ icon, label, value, pulse }) => (
          <div key={label} className="flex items-center justify-between bg-black/30 border border-white/5 px-2 py-1.5 rounded-lg">
            <div className="flex items-center gap-1.5 text-white/50">
              {icon}
              <span className="label-mono" style={{ color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>{label}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[9px] font-mono uppercase ${getTextColor(value || '')}`}>
                {(value || '').toUpperCase()}
              </span>
              <span className={`h-2 w-2 rounded-full flex-shrink-0 ${getIndicatorClass(value || '')} ${pulse ? 'animate-pulse' : ''}`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
