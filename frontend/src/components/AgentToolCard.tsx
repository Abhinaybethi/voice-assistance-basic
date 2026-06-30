import { motion, AnimatePresence } from 'framer-motion';

export type ToolCall = {
  id: string;
  tool: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: unknown;
  step: number;
};

const TOOL_META: Record<string, { icon: string; label: string; color: string }> = {
  search_web:        { icon: '🌐', label: 'Searching Web',       color: '#00d4ff' },
  open_application:  { icon: '🖥️', label: 'Opening App',         color: '#a78bfa' },
  open_url:          { icon: '🔗', label: 'Opening URL',          color: '#60a5fa' },
  close_application: { icon: '❌', label: 'Closing App',          color: '#f43f5e' },
  list_directory:    { icon: '📁', label: 'Listing Directory',    color: '#fbbf24' },
  read_file:         { icon: '📄', label: 'Reading File',         color: '#34d399' },
  write_file:        { icon: '✏️',  label: 'Writing File',         color: '#fb923c' },
  create_folder:     { icon: '📂', label: 'Creating Folder',      color: '#fbbf24' },
  search_files:      { icon: '🔍', label: 'Searching Files',      color: '#c084fc' },
  get_weather:       { icon: '🌤️', label: 'Fetching Weather',     color: '#38bdf8' },
  get_news:          { icon: '📰', label: 'Getting News',         color: '#f97316' },
  get_system_info:   { icon: '⚙️',  label: 'System Diagnostics',  color: '#10b981' },
  synthesize:        { icon: '💬', label: 'Synthesizing Answer',  color: '#00d4ff' },
  move_file:         { icon: '📦', label: 'Moving File',          color: '#fbbf24' },
  delete_file:       { icon: '🗑️', label: 'Deleting File',        color: '#f43f5e' },
};

function getToolMeta(tool: string) {
  return TOOL_META[tool] ?? { icon: '🔧', label: tool, color: '#94a3b8' };
}

function formatResult(result: unknown): string {
  if (!result) return '';
  if (typeof result === 'string') return result.slice(0, 120);
  const str = JSON.stringify(result);
  // Extract meaningful text
  const obj = result as Record<string, unknown>;
  if (obj.condition) return `${obj.temperature_c}°C, ${obj.condition}`;
  if (obj.query && obj.count !== undefined) return `Found ${obj.count} result(s) for "${obj.query}"`;
  if (obj.status) return `Status: ${obj.status}`;
  if (obj.city && obj.articles) return `${(obj.articles as unknown[]).length} headlines for ${obj.city}`;
  if (obj.path && obj.items) return `${(obj.items as unknown[]).length} items in ${obj.path}`;
  if (obj.content) return (obj.content as string).slice(0, 100) + '...';
  if (obj.error) return `Error: ${obj.error}`;
  return str.slice(0, 100);
}

interface AgentToolCardProps {
  toolCall: ToolCall;
}

export default function AgentToolCard({ toolCall }: AgentToolCardProps) {
  const meta = getToolMeta(toolCall.tool);
  const isDone = toolCall.status === 'done';
  const isError = toolCall.status === 'error';
  const isRunning = toolCall.status === 'running';

  const argsStr = Object.entries(toolCall.args || {})
    .map(([k, v]) => `${k}: ${String(v).slice(0, 30)}`)
    .join(' · ')
    .slice(0, 60);

  const resultStr = toolCall.result ? formatResult(toolCall.result) : '';

  return (
    <motion.div
      initial={{ opacity: 0, x: 15, scale: 0.96 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -10 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className="relative flex gap-3 p-2.5 rounded-lg border overflow-hidden"
      style={{
        borderColor: meta.color + '30',
        background: meta.color + '08',
      }}
    >
      {/* Left: step number */}
      <div
        className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-mono font-bold"
        style={{ background: meta.color + '20', color: meta.color, border: `1px solid ${meta.color}40` }}
      >
        {toolCall.step}
      </div>

      {/* Center: tool info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-sm leading-none">{meta.icon}</span>
          <span className="text-[11px] font-semibold" style={{ color: meta.color }}>
            {meta.label}
          </span>
          {argsStr && (
            <span className="text-[9px] font-mono text-white/30 truncate">· {argsStr}</span>
          )}
        </div>

        {/* Running progress bar */}
        {isRunning && (
          <div className="progress-bar-track mt-1">
            <div className="progress-bar-fill" style={{ width: '100%', background: `linear-gradient(90deg, ${meta.color}80, ${meta.color})` }} />
          </div>
        )}

        {/* Result */}
        {(isDone || isError) && resultStr && (
          <p className="text-[10px] font-mono mt-1 truncate" style={{ color: isError ? '#f43f5e80' : 'rgba(255,255,255,0.4)' }}>
            {resultStr}
          </p>
        )}
      </div>

      {/* Right: status indicator */}
      <div className="flex-shrink-0 flex items-center">
        {isRunning && (
          <div className="flex gap-1">
            <span className="thinking-dot" style={{ background: meta.color }} />
            <span className="thinking-dot" style={{ background: meta.color }} />
            <span className="thinking-dot" style={{ background: meta.color }} />
          </div>
        )}
        {isDone && <span className="text-emerald-400 text-sm">✓</span>}
        {isError && <span className="text-rose-400 text-sm">✕</span>}
      </div>

      {/* Shimmer overlay while running */}
      {isRunning && <div className="absolute inset-0 data-flow pointer-events-none rounded-lg" />}
    </motion.div>
  );
}
