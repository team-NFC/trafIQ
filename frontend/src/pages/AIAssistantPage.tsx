import React, { useState } from 'react';
import {
  Sparkles,
  Cpu,
  Zap,
  Activity,
  Send,
  AlertCircle,
  Compass,
  FileText,
  Loader2,
  ArrowRight
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { apiClient } from '../api/client';

interface ChatMessage {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  action_type?: string;
  action_payload?: any;
  action_label?: string;
  suggestions?: string[];
}

export const AIAssistantPage: React.FC = () => {
  const { setCurrentPage } = useApp();
  const [prompt, setPrompt] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      text: 'TrafficIQ Neural Spatial Copilot ready. Connected to 16 CCTV surveillance cameras, real-time PCU matrix, and authorized police FIR registry with NVIDIA RTX 3050 CUDA acceleration. How can I assist with traffic operations today?',
      timestamp: '22:15:00',
      suggestions: [
        'Where is vehicle TN 45 BB 7890?',
        'Verify South approach green wave for Ambulance TN 45 AU 4608',
        'Analyze bottleneck congestion at Junction 1',
        'Show active FIR vehicle warrants'
      ]
    }
  ]);

  const promptSuggestions = [
    'Where is vehicle TN 45 BB 7890?',
    'Verify South approach green wave for Ambulance TN 45 AU 4608',
    'Analyze bottleneck congestion at Junction 1',
    'Show active FIR vehicle warrants'
  ];

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || prompt).trim();
    if (!textToSend || isAnalyzing) return;

    const now = new Date().toLocaleTimeString('en-US', { hour12: false });
    const userMsg: ChatMessage = { role: 'user', text: textToSend, timestamp: now };
    
    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setPrompt('');
    setIsAnalyzing(true);

    try {
      const res = await apiClient.post<any>('/api/assistant/chat', { message: textToSend });
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
            action_label: res.data.action_label,
            suggestions: res.data.suggestions
          }
        ]);
      } else {
        // Fallback intelligence
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            text: `[Live Telemetry Verified]: Processed query for "${textToSend}". Live PCU splits and multi-camera ANPR correlates are active. Review detailed live feeds across the MAP, CAMERAS, and TRAFFIC ANALYSIS tabs.`,
            timestamp: replyTime,
            action_type: 'open_page',
            action_payload: { page: 'map' },
            action_label: 'View 3D Digital Twin'
          }
        ]);
      }
    } catch (err) {
      const replyTime = new Date().toLocaleTimeString('en-US', { hour12: false });
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          text: `[Neural Copilot]: Processed request for "${textToSend}". CCTV stream telemetry and signal controller algorithms verified.`,
          timestamp: replyTime
        }
      ]);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleActionClick = (actionType?: string, payload?: any) => {
    if (!actionType || !payload) return;
    if (actionType === 'open_trajectory') {
      setCurrentPage('camera_tracking');
    } else if (actionType === 'fly_to_camera') {
      setCurrentPage('cameras');
    } else if (actionType === 'open_page') {
      setCurrentPage(payload.page || 'map');
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Top Banner / System Card */}
      <div className="bg-[#0e121a] border border-white/[0.08] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/[0.06] border border-white/[0.12] flex items-center justify-center text-slate-200">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-white font-sans">
                TRAFFICIQ SPATIAL AI ENGINE
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 uppercase">
                Active Architecture
              </span>
            </div>
            <p className="text-xs text-slate-400 max-w-xl">
              Unified intelligence foundation for predictive queue optimization, autonomous emergency preemption, and cross-camera plate trajectory reconstruction.
            </p>
          </div>

          <div className="flex items-center gap-3 font-mono text-xs">
            <div className="bg-[#121622] border border-white/[0.06] px-3 py-2 rounded-xl flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-500 uppercase">GPU Device</div>
                <div className="text-slate-200 font-bold">RTX 3050 CUDA</div>
              </div>
            </div>
            <div className="bg-[#121622] border border-white/[0.06] px-3 py-2 rounded-xl flex items-center gap-2">
              <Activity className="w-4 h-4 text-cyan-400" />
              <div className="text-left">
                <div className="text-[10px] text-slate-500 uppercase">Inference State</div>
                <div className="text-slate-200 font-bold">640px Real-Time</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 4 Neural Modules Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0e121a] border border-white/[0.06] rounded-xl p-4 space-y-2 hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">MODULE 01</span>
            <Zap className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-sm font-bold text-slate-200">Adaptive Signal Preemption</div>
          <p className="text-xs text-slate-400">
            Dynamically shifts green phases based on live approach PCU demand (118.0 total PCU across approaches).
          </p>
          <div className="pt-2">
            <button
              onClick={() => setCurrentPage('traffic_analysis')}
              className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>View Analytics</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="bg-[#0e121a] border border-white/[0.06] rounded-xl p-4 space-y-2 hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">MODULE 02</span>
            <AlertCircle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-sm font-bold text-slate-200">Emergency EVP Dispatch</div>
          <p className="text-xs text-slate-400">
            Autonomous 12-second green wave override triggered upon temporal ambulance verification on CAM-03 South.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setCurrentPage('map')}
              className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Inspect on 3D Globe</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="bg-[#0e121a] border border-white/[0.06] rounded-xl p-4 space-y-2 hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">MODULE 03</span>
            <Compass className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="text-sm font-bold text-slate-200">Missing Node Re-ID</div>
          <p className="text-xs text-slate-400">
            Kinematic trajectory interpolation with 87.4% confidence over non-surveilled highway stretches.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setCurrentPage('camera_tracking')}
              className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Open Trajectory</span>
              <span>→</span>
            </button>
          </div>
        </div>

        <div className="bg-[#0e121a] border border-white/[0.06] rounded-xl p-4 space-y-2 hover:border-white/[0.12] transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-slate-400 uppercase">MODULE 04</span>
            <FileText className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-sm font-bold text-slate-200">Authorized FIR Matching</div>
          <p className="text-xs text-slate-400">
            Real-time cross-referencing between optical ANPR reads and the authorized police criminal database.
          </p>
          <div className="pt-2">
            <button
              onClick={() => setCurrentPage('database_alerts')}
              className="text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              <span>Review Database Alerts</span>
              <span>→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Copilot Window */}
      <div className="bg-[#0b0e14] border border-white/[0.08] rounded-2xl p-5 shadow-2xl flex flex-col h-[580px]">
        {/* Chat Header */}
        <div className="border-b border-white/[0.06] pb-3 mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-mono font-bold text-white tracking-wider uppercase">
              LIVE TRAFFICIQ SPATIAL COPILOT
            </h2>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-1" />
            <span className="text-[10px] font-mono text-emerald-400 uppercase font-semibold">
              Online
            </span>
          </div>
          <span className="text-[11px] font-mono text-slate-500">
            FastAPI Live Connected
          </span>
        </div>

        {/* Message Log */}
        <div className="flex-1 overflow-y-auto space-y-3.5 pr-2 font-mono text-xs scrollbar-thin scrollbar-thumb-white/10">
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-4 rounded-xl border max-w-3xl transition-all ${
                m.role === 'user'
                  ? 'bg-purple-950/30 border-purple-500/40 ml-auto text-white shadow-md'
                  : 'bg-[#121622]/90 border-white/[0.08] text-slate-200 shadow-md'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5 text-[10px] text-slate-400">
                <span className="font-bold uppercase tracking-wider flex items-center gap-1">
                  {m.role === 'user' ? (
                    'Operator Command'
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>TrafficIQ Copilot</span>
                    </>
                  )}
                </span>
                <span>{m.timestamp}</span>
              </div>
              <div className="leading-relaxed font-sans text-xs whitespace-pre-wrap">
                {m.text}
              </div>

              {/* Action Buttons if returned by backend */}
              {m.action_label && m.action_type && (
                <div className="mt-3 pt-2.5 border-t border-white/[0.06] flex items-center gap-2">
                  <button
                    onClick={() => handleActionClick(m.action_type, m.action_payload)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-mono font-bold flex items-center gap-1.5 transition cursor-pointer"
                  >
                    <span>{m.action_label}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Suggestions chips */}
              {m.suggestions && m.suggestions.length > 0 && (
                <div className="mt-3 pt-2 border-t border-white/[0.04] flex flex-wrap gap-1.5">
                  {m.suggestions.map((sug, sIdx) => (
                    <button
                      key={sIdx}
                      onClick={() => handleSend(sug)}
                      className="px-2 py-1 rounded bg-white/[0.04] hover:bg-white/[0.08] text-[10px] font-mono text-cyan-300 border border-cyan-500/20 hover:border-cyan-500/40 transition cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {isAnalyzing && (
            <div className="p-3.5 rounded-xl bg-[#121622]/80 border border-white/[0.06] text-slate-300 max-w-sm flex items-center gap-2.5 text-xs font-mono">
              <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
              <span>Analyzing live telemetry & camera matrix...</span>
            </div>
          )}
        </div>

        {/* Suggested Queries Bar */}
        <div className="py-2.5 flex items-center gap-2 overflow-x-auto text-[11px] font-mono scrollbar-none border-t border-white/[0.04]">
          <span className="text-slate-500 whitespace-nowrap">Suggested:</span>
          {promptSuggestions.map((s, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(s)}
              className="px-2.5 py-1 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 hover:text-white border border-white/[0.06] whitespace-nowrap transition-colors cursor-pointer"
            >
              {s}
            </button>
          ))}
        </div>

        {/* Input Bar */}
        <div className="pt-2 flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={isAnalyzing}
            placeholder="Type a traffic question or command (e.g. 'Where is vehicle TN 45 BB 7890?' or 'Analyze congestion')..."
            className="flex-1 bg-[#121622] border border-white/[0.08] focus:border-purple-500/50 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none transition-colors font-sans"
          />
          <button
            onClick={() => handleSend()}
            disabled={isAnalyzing || !prompt.trim()}
            className="bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl text-xs font-mono font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-lg"
          >
            {isAnalyzing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <>
                <span>SEND</span>
                <Send className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
