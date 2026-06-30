import { useState, useEffect } from 'react';
import { Database, Trash2, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface MemoryData {
  apps: Record<string, string>;
  folders: Record<string, string>;
  sites: Record<string, string>;
  commands: { command: string; tool?: string; timestamp: string }[];
  usage_counts: Record<string, number>;
  preferences: Record<string, unknown>;
}

const CATEGORY_META: Record<string, { icon: string; color: string; label: string }> = {
  apps:    { icon: '🖥️', color: '#a78bfa', label: 'Applications' },
  folders: { icon: '📁', color: '#fbbf24', label: 'Folders' },
  sites:   { icon: '🌐', color: '#60a5fa', label: 'Websites' },
};

export default function MemoryPanel() {
  const [memory, setMemory] = useState<MemoryData | null>(null);
  const [activeTab, setActiveTab] = useState<'apps' | 'folders' | 'sites' | 'history'>('apps');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newKey, setNewKey] = useState('');
  const [newVal, setNewVal] = useState('');

  useEffect(() => {
    fetchMemory();
    const interval = setInterval(fetchMemory, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchMemory = async () => {
    try {
      const res = await fetch('http://localhost:8000/api/memory');
      if (res.ok) {
        setMemory(await res.json());
      }
    } catch {
      // Backend offline — keep existing state
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!newKey.trim() || !newVal.trim()) return;
    try {
      await fetch('http://localhost:8000/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: activeTab, key: newKey.trim(), value: newVal.trim() })
      });
      setNewKey(''); setNewVal(''); setAdding(false);
      fetchMemory();
    } catch {}
  };

  const handleDelete = async (key: string) => {
    try {
      await fetch(`http://localhost:8000/api/memory/${activeTab}/${encodeURIComponent(key)}`, { method: 'DELETE' });
      fetchMemory();
    } catch {}
  };

  const getTopTools = () => {
    if (!memory?.usage_counts) return [];
    return Object.entries(memory.usage_counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tool, count]) => ({ tool, count }));
  };

  const currentEntries = memory ? (memory[activeTab as keyof MemoryData] as Record<string, string> || {}) : {};

  return (
    <div className="hud-panel p-3 flex flex-col gap-2.5">
      {/* Header */}
      <div className="flex justify-between items-center border-b border-[var(--clr-accent-dim)] pb-2">
        <h3 className="label-mono label-accent flex items-center gap-1.5">
          <Database size={12} className="text-[var(--clr-accent)]" />
          <span>AGENT MEMORY</span>
        </h3>
        <span className="label-mono label-dim">NEURAL-MEM</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(['apps', 'folders', 'sites', 'history'] as const).map(tab => {
          const meta = CATEGORY_META[tab] || { icon: '📋', color: '#94a3b8', label: 'History' };
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`text-[9px] font-mono px-2 py-0.5 rounded-full border transition-all ${
                activeTab === tab
                  ? 'border-[var(--clr-accent)] bg-[var(--clr-accent-dim)] text-[var(--clr-accent)]'
                  : 'border-white/10 text-white/30 hover:text-white/60'
              }`}
            >
              {meta.icon} {tab.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1.5 max-h-36 overflow-y-auto">
        {loading && (
          <div className="text-center py-3">
            <div className="flex gap-1 justify-center">
              <span className="thinking-dot" /><span className="thinking-dot" /><span className="thinking-dot" />
            </div>
          </div>
        )}

        <AnimatePresence mode="popLayout">
          {activeTab !== 'history' && Object.entries(currentEntries).map(([key, val]) => (
            <motion.div
              key={key}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex items-center justify-between gap-2 py-1 px-2 rounded-lg bg-white/2 border border-white/5 group hover:border-[var(--clr-accent-dim)] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[10px]">{CATEGORY_META[activeTab]?.icon || '📄'}</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-mono text-white/70 truncate capitalize">{key}</p>
                  <p className="text-[9px] font-mono text-white/30 truncate">{String(val).slice(0, 40)}</p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(key)}
                className="flex-shrink-0 text-white/0 group-hover:text-rose-500/60 hover:!text-rose-500 transition-colors"
              >
                <Trash2 size={10} />
              </button>
            </motion.div>
          ))}

          {activeTab === 'history' && (
            <motion.div key="hist" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
              <p className="label-mono label-dim mb-1">TOP TOOLS USED</p>
              {getTopTools().map(({ tool, count }) => (
                <div key={tool} className="flex items-center justify-between py-0.5 px-2 rounded bg-white/2">
                  <span className="text-[10px] font-mono text-white/50">{tool}</span>
                  <span className="text-[10px] font-mono text-[var(--clr-accent)]">{count}×</span>
                </div>
              ))}
              <p className="label-mono label-dim mt-2 mb-1">RECENT COMMANDS</p>
              {(memory?.commands || []).slice(0, 4).map((cmd, i) => (
                <div key={i} className="py-0.5 px-2 rounded bg-white/2">
                  <p className="text-[10px] font-mono text-white/40 truncate">{cmd.command}</p>
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {activeTab !== 'history' && !loading && Object.keys(currentEntries).length === 0 && (
          <p className="text-center text-[10px] font-mono text-white/20 py-2">No entries in {activeTab}</p>
        )}
      </div>

      {/* Add entry */}
      {activeTab !== 'history' && (
        <div className="border-t border-[var(--clr-accent-dim)] pt-2">
          {adding ? (
            <div className="flex flex-col gap-1.5">
              <div className="flex gap-1.5">
                <input
                  value={newKey} onChange={e => setNewKey(e.target.value)}
                  placeholder="Name (e.g. spotify)"
                  className="flex-1 bg-black/40 border border-[var(--clr-accent-dim)] rounded px-2 py-1 text-[10px] font-mono text-white placeholder-white/20 outline-none focus:border-[var(--clr-accent)]"
                />
                <input
                  value={newVal} onChange={e => setNewVal(e.target.value)}
                  placeholder="Value / path"
                  className="flex-1 bg-black/40 border border-[var(--clr-accent-dim)] rounded px-2 py-1 text-[10px] font-mono text-white placeholder-white/20 outline-none focus:border-[var(--clr-accent)]"
                />
              </div>
              <div className="flex gap-1.5">
                <button onClick={handleAdd} className="flex-1 text-[10px] font-mono py-1 rounded border border-[var(--clr-accent)] text-[var(--clr-accent)] bg-[var(--clr-accent-dim)] hover:bg-[var(--clr-accent-glow)] transition-colors">
                  SAVE
                </button>
                <button onClick={() => setAdding(false)} className="text-[10px] font-mono py-1 px-3 rounded border border-white/10 text-white/40 hover:text-white/70 transition-colors">
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAdding(true)} className="w-full flex items-center justify-center gap-1.5 text-[10px] font-mono text-white/30 hover:text-[var(--clr-accent)] transition-colors py-1">
              <Plus size={10} /> ADD ENTRY
            </button>
          )}
        </div>
      )}
    </div>
  );
}
