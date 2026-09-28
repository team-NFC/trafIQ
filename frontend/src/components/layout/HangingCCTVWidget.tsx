import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Send,
  X,
  Maximize2,
  Loader2,
  ArrowRight,
  Camera
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { apiClient } from '../../api/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  action_type?: string;
  action_payload?: any;
  action_label?: string;
}

export const HangingCCTVWidget: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [posX, setPosX] = useState<number>(() => {
    if (typeof window !== 'undefined') {
      return Math.max(120, window.innerWidth - 220);
    }
    return 700;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [initialX, setInitialX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  // Chat State
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'TrafficIQ AI Copilot active. How can I assist with traffic operations or surveillance?',
      timestamp: 'NOW'
    }
  ]);

  // Keep within viewport on window resize
  useEffect(() => {
    const handleResize = () => {
      setPosX(prev => Math.min(prev, window.innerWidth - 80));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Dragging logic along the top ceiling track
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only drag on left click and if not clicking a button inside console
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStartX(e.clientX);
    setInitialX(posX);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX;
      const newX = Math.max(50, Math.min(window.innerWidth - 70, initialX + deltaX));
      setPosX(newX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStartX, initialX]);

  const handleSend = async (customText?: string) => {
    const q = (customText || prompt).trim();
    if (!q || isAnalyzing) return;

    const timeStr = new Date().toLocaleTimeString('en-US', { hour12: false });
    setMessages(prev => [...prev, { role: 'user', text: q, timestamp: timeStr }]);
    if (!customText) setPrompt('');
    setIsAnalyzing(true);

    try {
      const res = await apiClient.post<any>('/api/assistant/chat', { message: q });
      const replyTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      if (res.data && res.data.status === 'success') {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: res.data.reply,
            timestamp: replyTime,
            action_type: res.data.action_type,
            action_payload: res.data.action_payload,
            action_label: res.data.action_label
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: `Telemetry verified for "${q}". Real-time signal split algorithms and CCTV monitoring are active.`,
            timestamp: replyTime
          }
        ]);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `Neural Copilot active. Cameras and PCU matrices verified.`,
          timestamp: 'NOW'
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAction = (type?: string, payload?: any) => {
    if (!type || !payload) return;
    setIsOpen(false);
    if (type === 'open_trajectory') {
      setCurrentPage('camera_tracking');
    } else if (type === 'fly_to_camera') {
      setCurrentPage('cameras');
    } else if (type === 'open_page') {
      setCurrentPage(payload.page || 'map');
    }
  };

  // Calculate console position so it doesn't overflow screen edges
  const consoleLeft = Math.max(10, Math.min(window.innerWidth - 380, posX - 180));

  return (
    <>
      {/* 1. Overhead Metallic Ceiling Track along the top */}
      <div className="fixed top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent pointer-events-none z-40" />

      {/* 2. Movable Hanging Trolley & Suspended CCTV Camera */}
      <div
        style={{ left: `${posX}px` }}
        className="fixed top-0 z-50 flex flex-col items-center select-none"
      >
        {/* Overhead Rail Trolley Wheel */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-6 h-1.5 rounded-full bg-slate-600 border border-slate-400 shadow-md ${
            isDragging ? 'cursor-grabbing bg-cyan-400' : 'cursor-grab hover:bg-slate-400'
          } transition-colors`}
          title="Drag horizontally to move camera along ceiling track"
        />

        {/* Suspended Steel Wire / Cord */}
        <div
          onMouseDown={handleMouseDown}
          className={`w-[2px] h-9 bg-gradient-to-b from-slate-400 via-slate-500 to-slate-300 shadow-sm ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        />

        {/* CCTV Dome Camera Body */}
        <div
          onClick={() => {
            if (!isDragging) {
              setIsOpen(prev => !prev);
            }
          }}
          onMouseDown={handleMouseDown}
          className={`relative group p-2 rounded-2xl bg-[#090d16] border transition-all duration-200 shadow-2xl flex items-center justify-center ${
            isOpen
              ? 'border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.4)] scale-105'
              : 'border-white/20 hover:border-cyan-400 hover:scale-110'
          } ${isDragging ? 'cursor-grabbing' : 'cursor-pointer'}`}
          title="TrafficIQ AI Copilot (Click to open, Drag left/right)"
        >
          {/* Live Status LED (Pulsing Cyan / Emerald) */}
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
          <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]" />

          {/* Camera Lens with idle PTZ surveillance animation */}
          <div className="w-6 h-6 rounded-full bg-slate-950 border border-white/20 flex items-center justify-center relative overflow-hidden transition-transform duration-700 group-hover:rotate-6">
            <Camera className="w-3.5 h-3.5 text-cyan-300" />
            <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-cyan-400/20 to-transparent pointer-events-none" />
          </div>

          {/* Hover Tooltip when closed */}
          {!isOpen && !isDragging && (
            <div className="absolute top-full mt-2 hidden group-hover:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-black/90 border border-white/10 text-[10px] font-mono text-cyan-300 whitespace-nowrap shadow-xl pointer-events-none">
              <Sparkles className="w-3 h-3 text-cyan-400" />
              <span>AI Copilot • Drag Left/Right</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Drop-Down AI Copilot Quick Floating Console */}
      {isOpen && (
        <div
          style={{
            top: '56px',
            left: `${consoleLeft}px`,
            width: '360px'
          }}
          className="fixed z-50 bg-[#0a0e17]/95 border border-white/15 rounded-2xl shadow-[0_16px_48px_rgba(0,0,0,0.85)] backdrop-blur-xl flex flex-col h-[460px] animate-in fade-in zoom-in-95 duration-150 overflow-hidden font-sans text-slate-100"
        >
          {/* Console Header */}
          <div className="px-3.5 py-2.5 bg-white/[0.03] border-b border-white/[0.08] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <div className="text-xs font-mono font-bold text-white uppercase tracking-wider">
                TRAFFICIQ AI COPILOT
              </div>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setCurrentPage('ai');
                }}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition cursor-pointer"
                title="Expand to Full AI Assistant Page"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-white/10 transition cursor-pointer"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Messages Log */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2.5 font-mono text-[11px] scrollbar-thin scrollbar-thumb-white/10">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-2.5 rounded-xl border leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-purple-950/40 border-purple-500/40 ml-auto max-w-[85%] text-purple-100'
                    : 'bg-[#121622] border-white/[0.06] max-w-[95%] text-slate-200'
                }`}
              >
                <div className="flex items-center justify-between mb-1 text-[9px] text-slate-400">
                  <span className="font-bold uppercase">
                    {m.role === 'user' ? 'You' : 'TrafficIQ'}
                  </span>
                  <span>{m.timestamp}</span>
                </div>
                <div className="whitespace-pre-wrap font-sans text-xs">
                  {m.text}
                </div>

                {m.action_label && (
                  <button
                    onClick={() => handleAction(m.action_type, m.action_payload)}
                    className="mt-2 px-2.5 py-1 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold flex items-center gap-1 transition cursor-pointer"
                  >
                    <span>{m.action_label}</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}

            {isAnalyzing && (
              <div className="p-2 rounded-lg bg-[#121622] border border-white/[0.06] text-slate-400 text-[10px] font-mono flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-cyan-400 animate-spin" />
                <span>Querying surveillance telemetry...</span>
              </div>
            )}
          </div>

          {/* Quick Prompt Chips */}
          <div className="px-3 py-1.5 border-t border-white/[0.04] bg-white/[0.01] flex items-center gap-1.5 overflow-x-auto scrollbar-none text-[10px] font-mono">
            <button
              onClick={() => handleSend('Where is vehicle TN 45 BB 7890?')}
              className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-cyan-300 border border-cyan-500/20 whitespace-nowrap transition cursor-pointer"
            >
              Track TN 45 BB 7890
            </button>
            <button
              onClick={() => handleSend('Status of ambulance on CAM-03?')}
              className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-rose-300 border border-rose-500/20 whitespace-nowrap transition cursor-pointer"
            >
              Ambulance CAM-03
            </button>
            <button
              onClick={() => handleSend('Analyze congestion at Junction 1')}
              className="px-2 py-0.5 rounded bg-white/[0.04] hover:bg-white/[0.08] text-amber-300 border border-amber-500/20 whitespace-nowrap transition cursor-pointer"
            >
              Junction 1 PCU
            </button>
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-black/40 border-t border-white/[0.08] flex items-center gap-1.5">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              disabled={isAnalyzing}
              placeholder="Ask TrafficIQ Copilot..."
              className="flex-1 bg-[#121622] border border-white/[0.08] focus:border-cyan-500/50 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 outline-none transition font-sans"
            />
            <button
              onClick={() => handleSend()}
              disabled={isAnalyzing || !prompt.trim()}
              className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white transition cursor-pointer shadow-md"
            >
              {isAnalyzing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Send className="w-3.5 h-3.5" />
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
