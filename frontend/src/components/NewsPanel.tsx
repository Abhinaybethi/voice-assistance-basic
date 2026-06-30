import { useState, useEffect } from 'react';
import { Newspaper, Loader2, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NewsItem {
  title: string;
  source: string;
  published: string;
  image: string;
}

interface NewsPanelProps {
  city: string;
}

export default function NewsPanel({ city }: NewsPanelProps) {
  const [loading, setLoading] = useState(false);
  const [news, setNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    fetchNews();
  }, [city]);

  const fetchNews = async () => {
    setLoading(true);
    try {
      const res = await fetch(`http://localhost:8000/api/news?city=${encodeURIComponent(city)}`);
      if (res.ok) {
        const data = await res.json();
        setNews(data);
      }
    } catch (err) {
      console.error("Failed to fetch news:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="hud-panel p-4 flex flex-col gap-3 flex-1 overflow-hidden">
      <div className="flex justify-between items-center border-b border-orange-500/20 pb-2">
        <h3 className="text-xs font-mono tracking-widest text-[#ff7b00] uppercase font-bold flex items-center gap-1.5">
          <Newspaper size={13} />
          <span>LOCAL INTELLIGENCE FEED</span>
        </h3>
        <span className="text-[9px] font-mono text-gray-500">LIVE FEED</span>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        {loading ? (
          <div className="h-full flex justify-center items-center py-10 gap-2 text-sm text-gray-400">
            <Loader2 size={16} className="animate-spin text-[#ff7b00]" />
            <span className="font-mono">SYNCHRONIZING FEED...</span>
          </div>
        ) : news.length === 0 ? (
          <div className="text-center py-10 text-xs text-gray-500 italic">No news feeds found.</div>
        ) : (
          <div className="flex flex-col gap-3">
            <AnimatePresence mode="popLayout">
              {news.map((item, idx) => (
                <motion.div
                  key={`${item.title}-${idx}`}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="group flex gap-3 bg-black/40 border border-orange-500/5 hover:border-orange-500/20 rounded-lg p-2.5 cursor-pointer transition-all duration-300 hover:shadow-[0_0_10px_rgba(255,123,0,0.05)]"
                >
                  <div className="h-14 w-20 flex-shrink-0 bg-gray-900 border border-orange-500/10 rounded overflow-hidden">
                    <img 
                      src={item.image} 
                      alt="" 
                      className="w-full h-full object-cover opacity-60 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500" 
                    />
                  </div>
                  
                  <div className="flex flex-col justify-between flex-grow min-w-0">
                    <h4 className="text-xs font-semibold text-gray-200 leading-snug line-clamp-2 group-hover:text-white group-hover:shadow-[#ff7b00]">
                      {item.title}
                    </h4>
                    <div className="flex justify-between items-center text-[9px] font-mono text-gray-500 mt-1">
                      <span className="text-[#ff7b00]/80">{item.source}</span>
                      <span>{item.published}</span>
                    </div>
                  </div>

                  <div className="flex-shrink-0 self-center text-gray-600 group-hover:text-[#ff7b00] transition-colors pl-1">
                    <ArrowUpRight size={13} />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}
