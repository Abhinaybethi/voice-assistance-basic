import { useState, useEffect, useRef } from 'react';
import { Terminal, Send, CornerDownLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

interface VoicePanelProps {
  city: string;
  onStatusChange: (status: 'idle' | 'listening' | 'processing' | 'speaking') => void;
  onSpeakerStateChange: (speaking: boolean) => void;
  transcript: string; // Live speech input from AudioVisualizer
  onClearTranscript: () => void;
}

export default function VoicePanel({
  city,
  onStatusChange,
  onSpeakerStateChange,
  transcript,
  onClearTranscript
}: VoicePanelProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `Systems online. I am JARVIS. Ready to assist. Tell me: "What's happening around me?" to receive local updates.`,
      timestamp: new Date()
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [typing, setTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Monitor live Speech Recognition transcript from the parent container
  useEffect(() => {
    if (transcript.trim()) {
      handleUserSubmit(transcript);
      onClearTranscript();
    }
  }, [transcript]);

  // Scroll to chat bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  const speakText = (text: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel(); // Stop ongoing speech
    
    // Clean markdown or bullet points from spoken text for a natural flow
    const cleanText = text
      .replace(/[*#`_\-]/g, '')
      .replace(/•/g, '')
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to set a high-quality default voice
    const voices = window.speechSynthesis.getVoices();
    const naturalVoice = voices.find(v => v.name.includes('Google') || v.name.includes('Natural') || v.lang === 'en-US');
    if (naturalVoice) utterance.voice = naturalVoice;

    utterance.onstart = () => {
      onStatusChange('speaking');
      onSpeakerStateChange(true);
    };

    utterance.onend = () => {
      onStatusChange('idle');
      onSpeakerStateChange(false);
    };

    utterance.onerror = () => {
      onStatusChange('idle');
      onSpeakerStateChange(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleUserSubmit = async (text: string) => {
    if (!text.trim()) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setTyping(true);
    onStatusChange('processing');

    // Simulate AI thinking and calling services
    setTimeout(async () => {
      let reply = "I am not programmed to understand that request yet. Ask me 'What's happening around me?' to test my systems.";
      
      const query = text.toLowerCase();

      if (query.includes("what's happening around me") || query.includes("news") || query.includes("happenings") || query.includes("update")) {
        // Fetch news details and query LLM summary
        try {
          // Get news cards
          const newsRes = await fetch(`http://localhost:8000/api/news?city=${encodeURIComponent(city)}`);
          if (newsRes.ok) {
            const newsData = await newsRes.json();
            const headlines = newsData.map((item: any) => item.title);
            
            // Get LLM summary
            const summarizeRes = await fetch('http://localhost:8000/api/summarize', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ city, headlines })
            });

            if (summarizeRes.ok) {
              const summaryData = await summarizeRes.json();
              reply = summaryData.summary;
            }
          }
        } catch (err) {
          reply = `Unable to link up satellite feeds for ${city}. However, my offline database indicates normal localized grid operations.`;
        }
      } else if (query.includes("hello") || query.includes("hi") || query.includes("hey")) {
        reply = `Hello. Voice diagnostics active. Current local location telemetry is locked to ${city}. How can I assist you today?`;
      } else if (query.includes("clear") || query.includes("reset")) {
        setMessages([]);
        setTyping(false);
        onStatusChange('idle');
        return;
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        text: reply,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, assistantMessage]);
      setTyping(false);
      onStatusChange('idle');
      
      // Speak the reply
      speakText(reply);
    }, 1500);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleUserSubmit(inputText);
  };

  return (
    <div className="hud-panel p-4 flex flex-col gap-3 flex-grow min-h-[320px] max-h-[460px] overflow-hidden">
      <div className="flex justify-between items-center border-b border-orange-500/20 pb-2">
        <h3 className="text-xs font-mono tracking-widest text-[#ff7b00] uppercase font-bold flex items-center gap-1.5">
          <Terminal size={13} />
          <span>COGNITIVE CORE RESPONSE</span>
        </h3>
        <span className="text-[9px] font-mono text-gray-500">CONVERSATIONAL CAPTURE</span>
      </div>

      {/* Message Chat List */}
      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className={`flex flex-col gap-1 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-lg p-2.5 text-xs ${
                  msg.role === 'user'
                    ? 'bg-[#ff7b00]/10 border border-orange-500/30 text-white rounded-br-none'
                    : 'bg-black/40 border border-orange-500/10 text-gray-200 rounded-bl-none'
                }`}
              >
                <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
              <span className="text-[8px] font-mono text-gray-500 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </motion.div>
          ))}
        </AnimatePresence>

        {typing && (
          <div className="flex flex-col gap-1 items-start">
            <div className="bg-black/40 border border-orange-500/10 text-gray-400 rounded-lg rounded-bl-none p-2.5 text-xs animate-pulse font-mono flex items-center gap-2">
              <span className="h-1.5 w-1.5 bg-[#ff7b00] rounded-full animate-bounce"></span>
              <span className="h-1.5 w-1.5 bg-[#ff7b00] rounded-full animate-bounce [animation-delay:0.2s]"></span>
              <span className="h-1.5 w-1.5 bg-[#ff7b00] rounded-full animate-bounce [animation-delay:0.4s]"></span>
              <span>JARVIS ANALYSIS IN PROGRESS...</span>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input controls form */}
      <form onSubmit={handleFormSubmit} className="flex gap-2 border-t border-orange-500/10 pt-3 flex-shrink-0">
        <div className="relative flex-grow">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Instruct JARVIS (e.g. 'What's happening around me?')"
            className="w-full bg-black/40 border border-orange-500/20 focus:border-[#ff7b00] focus:ring-1 focus:ring-[#ff7b00] rounded-lg pl-3 pr-8 py-2 text-xs text-white placeholder-gray-600 outline-none transition-all"
          />
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-gray-600 flex items-center gap-0.5">
            <CornerDownLeft size={8} /> Enter
          </span>
        </div>
        <button
          type="submit"
          disabled={!inputText.trim()}
          className="bg-[#ff7b00]/10 hover:bg-[#ff7b00]/20 border border-orange-500/30 hover:border-[#ff7b00] text-[#ff7b00] p-2 rounded-lg transition-all disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:border-orange-500/30"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
}
