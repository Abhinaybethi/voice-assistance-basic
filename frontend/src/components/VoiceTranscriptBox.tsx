import { useState, useEffect, useRef } from 'react';
import { Send, Mic, MicOff, X, Edit3 } from 'lucide-react';

interface VoiceTranscriptBoxProps {
  /** Live interim text streamed from AudioVisualizer */
  interimText: string;
  /** Finalized committed text from AudioVisualizer */
  finalText: string;
  /** Whether microphone / speech recognition is active */
  isListening: boolean;
  /** Called when user submits (via Enter or button) */
  onSubmit: (text: string) => void;
  /** Called to clear state after submit */
  onClear: () => void;
  /** Disabled while agent is running */
  disabled?: boolean;
}

export default function VoiceTranscriptBox({
  interimText,
  finalText,
  isListening,
  onSubmit,
  onClear,
  disabled = false,
}: VoiceTranscriptBoxProps) {
  const [editableText, setEditableText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const prevFinalRef = useRef('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Sync final transcript into editable field
  useEffect(() => {
    if (finalText && finalText !== prevFinalRef.current) {
      prevFinalRef.current = finalText;
      setEditableText(finalText);
      setIsEditing(false);
    }
  }, [finalText]);

  // When listening starts fresh, reset
  useEffect(() => {
    if (isListening && !finalText) {
      setEditableText('');
      setIsEditing(false);
      prevFinalRef.current = '';
    }
  }, [isListening, finalText]);

  // Best text to show
  const displayText = isEditing ? editableText : (finalText || interimText);
  const isInterim = !isEditing && !finalText && !!interimText;
  const hasContent = displayText.trim().length > 0;

  const handleSubmit = () => {
    const text = (isEditing ? editableText : displayText).trim();
    if (!text || disabled) return;
    onSubmit(text);
    setEditableText('');
    setIsEditing(false);
    prevFinalRef.current = '';
    onClear();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditableText(finalText || interimText);
    }
  };

  const handleEditClick = () => {
    setEditableText(displayText);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleClear = () => {
    setEditableText('');
    setIsEditing(false);
    prevFinalRef.current = '';
    onClear();
  };

  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${
        isListening
          ? 'border-rose-500/60 shadow-[0_0_20px_rgba(244,63,94,0.15)]'
          : hasContent
          ? 'border-[var(--clr-agent)]/40 shadow-[0_0_16px_rgba(0,212,255,0.1)]'
          : 'border-white/8'
      }`}
      style={{ background: 'rgba(4,4,12,0.85)', backdropFilter: 'blur(20px)' }}
    >
      {/* ── Header bar ──────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {isListening && (
              <span className="absolute h-4 w-4 rounded-full bg-rose-500/20 animate-ping" />
            )}
            <span
              className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                isListening ? 'bg-rose-500' : hasContent ? 'bg-[var(--clr-agent)]' : 'bg-white/15'
              }`}
              style={
                isListening
                  ? { boxShadow: '0 0 8px rgba(244,63,94,0.8)' }
                  : hasContent
                  ? { boxShadow: '0 0 8px rgba(0,212,255,0.5)' }
                  : {}
              }
            />
          </div>
          <span className="text-[9px] font-mono tracking-[0.2em] uppercase text-white/30">
            {isListening
              ? 'Live Transcription'
              : isEditing
              ? 'Editing'
              : hasContent
              ? 'Ready to Send'
              : 'Voice Input'}
          </span>
          {isInterim && (
            <span className="text-[8px] font-mono text-rose-400/70 tracking-widest animate-pulse">
              ● LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {hasContent && !isEditing && !isListening && (
            <button
              onClick={handleEditClick}
              title="Edit transcript"
              className="p-1 rounded-lg text-white/25 hover:text-[var(--clr-agent)] hover:bg-[var(--clr-agent-dim)] transition-all"
            >
              <Edit3 size={11} />
            </button>
          )}
          {hasContent && (
            <button
              onClick={handleClear}
              title="Clear"
              className="p-1 rounded-lg text-white/20 hover:text-rose-400 hover:bg-rose-500/10 transition-all"
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* ── Text area ───────────────────────────────────────────────── */}
      <div className="relative min-h-[80px] max-h-[140px] px-4 py-3 overflow-y-auto">
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={editableText}
            onChange={e => setEditableText(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (!editableText.trim()) setIsEditing(false);
            }}
            rows={3}
            className="w-full bg-transparent outline-none resize-none text-white leading-relaxed placeholder:text-white/15"
            placeholder="Type your command… (Enter to send)"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
          />
        ) : hasContent ? (
          <div
            className="leading-relaxed select-text cursor-text"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
            onClick={handleEditClick}
          >
            <span className={isInterim ? 'text-white/45 italic' : 'text-white/90'}>
              {displayText}
            </span>
            {isListening && (
              <span className="inline-block w-0.5 h-4 bg-rose-400 ml-0.5 animate-pulse align-middle rounded-full" />
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 pointer-events-none select-none py-2">
            <div className="flex items-center gap-2 text-white/15">
              {isListening ? (
                <Mic size={16} className="text-rose-400/40 animate-pulse" />
              ) : (
                <MicOff size={16} />
              )}
              <span className="text-[11px] font-mono tracking-wide">
                {isListening ? 'Listening… speak now' : 'Click mic button to start speaking'}
              </span>
            </div>
            <span className="text-[9px] font-mono text-white/10 tracking-widest">
              OR TYPE YOUR QUERY IN THE AGENT CONSOLE BELOW
            </span>
          </div>
        )}
      </div>

      {/* ── Footer / Submit bar ─────────────────────────────────────── */}
      {hasContent && (
        <div className="flex items-center justify-between px-4 py-2 border-t border-white/5">
          <span className="text-[9px] font-mono text-white/20">
            {isEditing ? 'SHIFT+ENTER new line · ESC cancel' : 'CLICK TO EDIT · ENTER TO SEND'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={disabled || !hasContent}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-mono font-bold tracking-wider transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: 'rgba(0,212,255,0.14)',
              border: '1px solid rgba(0,212,255,0.3)',
              color: 'var(--clr-agent)',
            }}
            onMouseOver={e => {
              if (!disabled) e.currentTarget.style.background = 'rgba(0,212,255,0.26)';
            }}
            onMouseOut={e => {
              e.currentTarget.style.background = 'rgba(0,212,255,0.14)';
            }}
          >
            <Send size={10} />
            SEND
          </button>
        </div>
      )}

      {/* ── Scanning bottom bar when listening ──────────────────────── */}
      {isListening && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden">
          <div
            className="h-full"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(244,63,94,0.7), rgba(255,123,0,0.6), transparent)',
              backgroundSize: '200% 100%',
              animation: 'data-flow 1.2s linear infinite',
            }}
          />
        </div>
      )}
    </div>
  );
}
