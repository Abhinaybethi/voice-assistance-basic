import { useState, useEffect, useRef, useCallback } from 'react';
import { Bot, Send, Zap, RotateCcw, ChevronRight, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import AgentToolCard from './AgentToolCard';
import type { ToolCall } from './AgentToolCard';

interface Step {
  step_number: number;
  description: string;
  tool: string;
  status: 'pending' | 'running' | 'done' | 'error';
  result?: unknown;
}

interface AgentResult {
  goal: string;
  steps: Step[];
  final_answer: string;
  spoken_summary: string;
  tool_calls: ToolCall[];
  success: boolean;
  mode: string;
}

interface AgentConsoleProps {
  city: string;
  onStatusChange: (status: 'idle' | 'listening' | 'processing' | 'speaking' | 'executing') => void;
  onSpeakerStateChange: (active: boolean) => void;
  transcript: string;
  onClearTranscript: () => void;
}

const QUICK_ACTIONS = [
  { label: '🌤️ Weather', goal: 'What is the weather like right now?' },
  { label: '📰 News',    goal: "What's happening around me today?" },
  { label: '⚙️ System',  goal: 'Show me current system performance stats' },
  { label: '🌐 Search',  goal: 'Search for the latest AI news' },
  { label: '🖥️ Chrome',  goal: 'Open Chrome browser' },
  { label: '📁 Files',   goal: 'List my Downloads folder' },
];

function speakText(text: string, onStart: () => void, onEnd: () => void) {
  if (!window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[*#`_~\-•]/g, '').replace(/\n+/g, ' ').trim();
  const utterance = new SpeechSynthesisUtterance(clean);
  const voices = window.speechSynthesis.getVoices();
  const natural = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang === 'en-US');
  if (natural) utterance.voice = natural;
  utterance.onstart = onStart;
  utterance.onend = onEnd;
  utterance.onerror = onEnd;
  window.speechSynthesis.speak(utterance);
}

export default function AgentConsole({
  city, onStatusChange, onSpeakerStateChange, transcript, onClearTranscript
}: AgentConsoleProps) {
  const [goal, setGoal] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCall[]>([]);
  const [finalAnswer, setFinalAnswer] = useState<string | null>(null);
  const [history, setHistory] = useState<{ goal: string; answer: string; toolCount: number }[]>([]);
  const [mode, setMode] = useState<'plan' | 'history'>('plan');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Consume voice transcript
  useEffect(() => {
    if (transcript.trim()) {
      setGoal(transcript);
      onClearTranscript();
    }
  }, [transcript, onClearTranscript]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [activeToolCalls, finalAnswer]);

  const executeGoal = useCallback(async (goalText: string) => {
    if (!goalText.trim() || isRunning) return;

    setIsRunning(true);
    setActiveToolCalls([]);
    setFinalAnswer(null);
    setMode('plan');
    onStatusChange('executing');

    try {
      const response = await fetch('http://localhost:8000/api/agent/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalText, city })
      });

      if (!response.ok) throw new Error('Agent request failed');
      const result: AgentResult = await response.json();

      // Animate tool calls sequentially
      const calls: ToolCall[] = (result.tool_calls || []).map((tc, i) => ({
        id: `tc-${i}`,
        tool: tc.tool || 'synthesize',
        args: tc.args || {},
        status: 'done' as const,
        result: tc.result,
        step: i + 1
      }));

      // Play them in sequence with a slight delay for visual effect
      for (let i = 0; i < calls.length; i++) {
        const runningCall = { ...calls[i], status: 'running' as const };
        setActiveToolCalls(prev => [...prev, runningCall]);
        await new Promise(r => setTimeout(r, 400));
        setActiveToolCalls(prev => prev.map(c => c.id === calls[i].id ? calls[i] : c));
        await new Promise(r => setTimeout(r, 150));
      }

      if (calls.length === 0) {
        // Direct answer — show a synthesize card
        const synthCall: ToolCall = { id: 'synth-0', tool: 'synthesize', args: {}, status: 'done', result: result.final_answer, step: 1 };
        setActiveToolCalls([synthCall]);
      }

      setFinalAnswer(result.final_answer || 'Neural OS completed the task.');

      // Add to history
      setHistory(prev => [{ goal: goalText, answer: result.final_answer || '', toolCount: calls.length }, ...prev].slice(0, 10));

      // Speak the result
      onStatusChange('speaking');
      speakText(
        result.spoken_summary || result.final_answer || '',
        () => onSpeakerStateChange(true),
        () => { onStatusChange('idle'); onSpeakerStateChange(false); }
      );

    } catch (err) {
      setFinalAnswer('Unable to connect to Neural OS backend. Ensure the server is running on port 8000.');
      onStatusChange('idle');
    } finally {
      setIsRunning(false);
    }
  }, [isRunning, city, onStatusChange, onSpeakerStateChange]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (goal.trim()) {
      executeGoal(goal);
      setGoal('');
    }
  };

  const handleQuickAction = (quickGoal: string) => {
    setGoal('');
    executeGoal(quickGoal);
  };

  const handleClear = () => {
    setActiveToolCalls([]);
    setFinalAnswer(null);
    onStatusChange('idle');
  };

  return (
    <div className="agent-panel p-4 flex flex-col gap-3 flex-grow min-h-[320px] max-h-[520px] overflow-hidden">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[var(--clr-agent-dim)] pb-2 flex-shrink-0">
        <h3 className="label-mono label-agent flex items-center gap-1.5">
          <Bot size={13} className="text-[var(--clr-agent)]" />
          <span>AGENT CONSOLE</span>
          {isRunning && (
            <span className="ml-1 flex gap-1">
              <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
            </span>
          )}
        </h3>
        <div className="flex items-center gap-2">
          {(activeToolCalls.length > 0 || finalAnswer) && !isRunning && (
            <button onClick={handleClear} className="text-gray-500 hover:text-[var(--clr-agent)] transition-colors" title="Clear">
              <RotateCcw size={11} />
            </button>
          )}
          <span className="label-mono label-dim">NEURAL-OS v2.0</span>
        </div>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 flex-shrink-0">
        {(['plan', 'history'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setMode(tab)}
            className={`text-[10px] font-mono px-3 py-1 rounded-full border transition-all ${
              mode === tab
                ? 'border-[var(--clr-agent)] bg-[var(--clr-agent-dim)] text-[var(--clr-agent)]'
                : 'border-white/10 text-white/30 hover:text-white/60'
            }`}
          >
            {tab === 'plan' ? '⚡ EXECUTION' : '📋 HISTORY'}
          </button>
        ))}
      </div>

      {/* Main content area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-2 agent-scroll pr-0.5">
        <AnimatePresence mode="popLayout">

          {/* EXECUTION TAB */}
          {mode === 'plan' && (
            <motion.div key="plan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">

              {/* Empty state */}
              {activeToolCalls.length === 0 && !isRunning && !finalAnswer && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-center py-6">
                  <div className="text-4xl mb-3">🤖</div>
                  <p className="text-[11px] font-mono text-white/30 leading-relaxed">
                    Neural OS is standing by.<br />
                    Type a goal or use quick actions below.
                  </p>
                </motion.div>
              )}

              {/* Tool calls */}
              {activeToolCalls.map(tc => (
                <AgentToolCard key={tc.id} toolCall={tc} />
              ))}

              {/* Final Answer */}
              {finalAnswer && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="p-3 rounded-lg border border-[var(--clr-agent-dim)] bg-[var(--clr-agent-dim)] relative overflow-hidden"
                >
                  <div className="flex items-start gap-2">
                    <span className="text-[var(--clr-agent)] text-sm flex-shrink-0 mt-0.5">◈</span>
                    <div>
                      <p className="text-[10px] font-mono text-[var(--clr-agent)] mb-1">NEURAL OS RESPONSE</p>
                      <p className="text-xs text-white/80 leading-relaxed">{finalAnswer}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* HISTORY TAB */}
          {mode === 'history' && (
            <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-2">
              {history.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-[11px] font-mono text-white/25">No completed tasks yet.</p>
                </div>
              ) : (
                history.map((h, i) => (
                  <div key={i} className="p-2.5 rounded-lg border border-white/5 bg-white/2 space-y-1 cursor-pointer hover:border-[var(--clr-agent-dim)] transition-colors"
                    onClick={() => { setGoal(h.goal); setMode('plan'); }}>
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] text-white/70 font-mono truncate flex-1">{h.goal}</p>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <span className="text-[9px] font-mono text-[var(--clr-agent-dim)]">{h.toolCount} tools</span>
                        <ChevronRight size={10} className="text-white/20" />
                      </div>
                    </div>
                    <p className="text-[10px] text-white/30 leading-relaxed line-clamp-2">{h.answer}</p>
                  </div>
                ))
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* Quick actions */}
      <div className="flex gap-1.5 flex-wrap flex-shrink-0 border-t border-[var(--clr-agent-dim)] pt-2">
        {QUICK_ACTIONS.map(qa => (
          <button key={qa.label} onClick={() => handleQuickAction(qa.goal)} disabled={isRunning}
            className="quick-pill disabled:opacity-30 disabled:cursor-not-allowed">
            {qa.label}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <input
            value={goal}
            onChange={e => setGoal(e.target.value)}
            placeholder={isRunning ? 'Neural OS is executing...' : 'Give Neural OS a goal...'}
            disabled={isRunning}
            className="agent-input pr-8"
          />
          <Mic size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/20" />
        </div>
        <button
          type="submit"
          disabled={!goal.trim() || isRunning}
          className="flex-shrink-0 w-10 h-10 rounded-xl border transition-all flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            borderColor: 'var(--clr-agent-dim)',
            background: 'var(--clr-agent-dim)',
            color: 'var(--clr-agent)'
          }}
          onMouseOver={e => !e.currentTarget.disabled && (e.currentTarget.style.background = 'rgba(0,212,255,0.25)')}
          onMouseOut={e => (e.currentTarget.style.background = 'var(--clr-agent-dim)')}
        >
          {isRunning
            ? <Zap size={15} className="animate-pulse" />
            : <Send size={14} />}
        </button>
      </form>
    </div>
  );
}
