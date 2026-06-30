import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Zap, ExternalLink, Bot, User, RotateCcw, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Source {
  title: string;
  url: string;
  snippet: string;
  score: number;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  sources?: Source[];
  engine?: string;
  timestamp: Date;
}

interface ChatPanelProps {
  city: string;
}

const QUICK_QUESTIONS = [
  { label: '🌤️ Weather', q: 'What is the current weather today?' },
  { label: '💡 AI News', q: 'What are the latest AI developments?' },
  { label: '🏏 Sports',  q: 'Latest cricket scores and results' },
  { label: '📈 Markets', q: 'How are global stock markets doing today?' },
];

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-1">
      {[0, 1, 2].map(i => (
        <span
          key={i}
          className="thinking-dot"
          style={{ animationDelay: `${i * 0.2}s` }}
        />
      ))}
    </div>
  );
}

export default function ChatPanel({ city }: ChatPanelProps) {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [showSources, setShowSources] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  // Welcome message on mount
  useEffect(() => {
    setMessages([{
      id: 'welcome',
      role: 'assistant',
      text: `Neural OS online. Powered by Tavily AI Search. Ask me anything — I fetch real-time answers from the web. Your location: ${city}.`,
      timestamp: new Date(),
    }]);
  }, []);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: text.trim(),
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('http://localhost:8000/api/tavily/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text.trim(), city, search_depth: 'advanced' }),
      });
      const data = await res.json();

      const aiMsg: Message = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        text: data.reply || 'No response received.',
        sources: data.sources || [],
        engine: data.engine,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: 'assistant',
        text: '⚠️ Backend offline. Ensure the server is running on port 8000.',
        timestamp: new Date(),
      }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [loading, city]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const clearChat = () => {
    setMessages([{
      id: 'welcome-2',
      role: 'assistant',
      text: 'Session cleared. Ready for new queries.',
      timestamp: new Date(),
    }]);
    setShowSources(null);
  };

  return (
    <div className="agent-panel flex flex-col h-full min-h-0 overflow-hidden">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--clr-agent-dim)] flex-shrink-0">
        <div className="flex items-center gap-2">
          <Search size={12} className="text-[var(--clr-agent)]" />
          <span className="label-mono label-agent">TAVILY CHAT</span>
          <span className="flex gap-1">
            <span className="thinking-dot" style={{ width: 4, height: 4, animationDelay: '0s' }} />
            <span className="thinking-dot" style={{ width: 4, height: 4, animationDelay: '0.2s' }} />
            <span className="thinking-dot" style={{ width: 4, height: 4, animationDelay: '0.4s' }} />
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="label-mono label-dim text-[9px]">WEB-GROUNDED AI</span>
          {messages.length > 1 && (
            <button onClick={clearChat} title="Clear" className="text-white/20 hover:text-[var(--clr-agent)] transition-colors">
              <RotateCcw size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Message Feed ── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3 agent-scroll min-h-0">
        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
            >
              {/* Avatar */}
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-0.5
                ${msg.role === 'user'
                  ? 'bg-[var(--clr-accent-dim)] border border-[var(--clr-accent-dim)]'
                  : 'bg-[var(--clr-agent-dim)] border border-[var(--clr-agent-dim)]'}`}>
                {msg.role === 'user'
                  ? <User size={10} className="text-[var(--clr-accent)]" />
                  : <Bot size={10} className="text-[var(--clr-agent)]" />}
              </div>

              {/* Bubble */}
              <div className={`flex flex-col gap-1.5 max-w-[82%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-xl px-3 py-2 text-xs leading-relaxed
                  ${msg.role === 'user'
                    ? 'bg-[var(--clr-accent-dim)] border border-[var(--clr-accent-dim)] text-orange-100 rounded-tr-sm'
                    : 'bg-[rgba(0,212,255,0.07)] border border-[var(--clr-agent-dim)] text-white/85 rounded-tl-sm'}`}>
                  {msg.text}
                </div>

                {/* Sources toggle */}
                {msg.sources && msg.sources.length > 0 && (
                  <div className="space-y-1 w-full">
                    <button
                      onClick={() => setShowSources(showSources === msg.id ? null : msg.id)}
                      className="flex items-center gap-1.5 text-[9px] font-mono text-[var(--clr-agent)]/60
                        hover:text-[var(--clr-agent)] transition-colors"
                    >
                      <ExternalLink size={9} />
                      {msg.sources.length} sources · {showSources === msg.id ? 'hide' : 'show'}
                    </button>

                    <AnimatePresence>
                      {showSources === msg.id && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-1 overflow-hidden"
                        >
                          {msg.sources.map((src, i) => (
                            <a
                              key={i}
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-start gap-1.5 p-2 rounded-lg border border-white/5
                                bg-white/2 hover:border-[var(--clr-agent-dim)] hover:bg-[var(--clr-agent-dim)]
                                transition-all group block"
                            >
                              <span className="text-[9px] font-mono text-[var(--clr-agent)]/50 group-hover:text-[var(--clr-agent)] mt-0.5 flex-shrink-0">
                                [{i + 1}]
                              </span>
                              <div className="min-w-0">
                                <p className="text-[10px] text-white/70 group-hover:text-white/90 truncate leading-tight">
                                  {src.title || src.url}
                                </p>
                                {src.snippet && (
                                  <p className="text-[9px] text-white/30 leading-tight mt-0.5 line-clamp-2">
                                    {src.snippet}
                                  </p>
                                )}
                              </div>
                              <ExternalLink size={8} className="flex-shrink-0 text-white/20 group-hover:text-[var(--clr-agent)] mt-0.5" />
                            </a>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Timestamp */}
                <span className="text-[8px] font-mono text-white/15 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </motion.div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <motion.div
              key="typing"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex gap-2"
            >
              <div className="w-6 h-6 rounded-full bg-[var(--clr-agent-dim)] border border-[var(--clr-agent-dim)] flex items-center justify-center flex-shrink-0 mt-0.5">
                <Bot size={10} className="text-[var(--clr-agent)]" />
              </div>
              <div className="bg-[rgba(0,212,255,0.07)] border border-[var(--clr-agent-dim)] rounded-xl rounded-tl-sm px-3 py-2">
                <TypingDots />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Quick Questions ── */}
      <div className="flex gap-1.5 flex-wrap px-3 pt-1 pb-1 flex-shrink-0">
        {QUICK_QUESTIONS.map(q => (
          <button
            key={q.label}
            onClick={() => sendMessage(q.q)}
            disabled={loading}
            className="quick-pill disabled:opacity-30 disabled:cursor-not-allowed text-[9px] py-[3px] px-2"
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* ── Input Bar ── */}
      <form
        onSubmit={handleSubmit}
        className="flex gap-2 px-3 pb-3 pt-1 flex-shrink-0 border-t border-[var(--clr-agent-dim)]"
      >
        <div className="relative flex-1">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={loading ? 'Searching the web…' : 'Ask anything — powered by Tavily…'}
            disabled={loading}
            className="agent-input pr-8 text-[11px]"
            autoComplete="off"
          />
          <Search
            size={11}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/15 pointer-events-none"
          />
        </div>
        <button
          type="submit"
          disabled={!input.trim() || loading}
          title="Send"
          className="flex-shrink-0 w-9 h-9 rounded-xl border transition-all flex items-center justify-center
            disabled:opacity-30 disabled:cursor-not-allowed"
          style={{
            borderColor: 'var(--clr-agent-dim)',
            background: 'var(--clr-agent-dim)',
            color: 'var(--clr-agent)',
          }}
          onMouseOver={e => { if (!e.currentTarget.disabled) e.currentTarget.style.background = 'rgba(0,212,255,0.25)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'var(--clr-agent-dim)'; }}
        >
          {loading
            ? <Zap size={13} className="animate-pulse" />
            : <Send size={13} />}
        </button>
      </form>
    </div>
  );
}
