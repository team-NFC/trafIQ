import React from 'react';
import { CloudSun, Clock, Radio } from 'lucide-react';
import { WeatherData } from '../../api/godview';

interface ScenarioBarProps {
  activeScenario: string;
  onSelectScenario: (scenario: string) => void;
  loading: boolean;
  weather: WeatherData | null;
  systemTime: string;
}

export const ScenarioBar: React.FC<ScenarioBarProps> = ({
  activeScenario,
  onSelectScenario,
  loading,
  weather,
  systemTime,
}) => {
  const scenarios = [
    {
      id: 'normal',
      label: 'NORMAL TRAFFIC',
      tag: 'ZONE 1 (4-WAY)',
      desc: 'Adaptive Signal Control',
      activeColor: 'bg-cyan-600 text-white border-cyan-400 shadow-cyan-900/50',
    },
    {
      id: 'ambulance',
      label: 'AMBULANCE PRIORITY',
      tag: 'EVP ACTIVE',
      desc: 'Emergency Vehicle Preemption',
      activeColor: 'bg-rose-600 text-white border-rose-400 shadow-rose-900/50',
    },
    {
      id: 'anpr_missing',
      label: 'ANPR + MISSING NODE',
      tag: 'ZONE 3 (RECONSTRUCTED)',
      desc: 'Interpolated Trajectory',
      activeColor: 'bg-amber-600 text-white border-amber-400 shadow-amber-900/50',
    },
    {
      id: 'anpr_continuous',
      label: 'ANPR + CONTINUOUS',
      tag: 'ZONE 4 (VERIFIED)',
      desc: 'Unbroken Journey Tracking',
      activeColor: 'bg-emerald-600 text-white border-emerald-400 shadow-emerald-900/50',
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#090e1a]/95 backdrop-blur-xl p-4 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
      {/* Scenario Selector Buttons */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5 mr-2">
          <Radio className="w-4 h-4 text-cyan-400 animate-pulse" />
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-slate-300">
            DEMO SCENARIOS:
          </span>
        </div>

        {scenarios.map((sc) => {
          const isActive = activeScenario === sc.id;
          return (
            <button
              key={sc.id}
              onClick={() => onSelectScenario(sc.id)}
              disabled={loading}
              className={`group px-3.5 py-2 rounded-xl border text-xs font-mono font-bold transition-all duration-200 cursor-pointer flex flex-col items-start gap-0.5 shadow-md ${
                isActive
                  ? `${sc.activeColor} ring-2 ring-cyan-500/20`
                  : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="tracking-wide">{sc.label}</span>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded font-mono ${
                    isActive ? 'bg-black/30 text-white' : 'bg-slate-800 text-slate-500'
                  }`}
                >
                  {sc.tag}
                </span>
              </div>
              <span
                className={`text-[10px] font-sans font-normal ${
                  isActive ? 'text-slate-100' : 'text-slate-500'
                }`}
              >
                {sc.desc}
              </span>
            </button>
          );
        })}
      </div>

      {/* Weather & System Clock Badge */}
      <div className="flex items-center gap-3 self-end lg:self-auto shrink-0">
        {/* Weather Badge */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs font-mono">
          <CloudSun className="w-4 h-4 text-amber-400 shrink-0" />
          <div>
            <div className="flex items-center gap-1 text-slate-200 font-bold">
              <span>{weather ? `${weather.temperature}°C` : '32.4°C'}</span>
              <span className="text-slate-500 text-[10px] font-sans">
                {weather ? weather.condition : 'Trichy'}
              </span>
            </div>
            <div className="text-[10px] text-slate-500 font-sans">
              Humidity {weather ? `${weather.humidity}%` : '63%'}
            </div>
          </div>
        </div>

        {/* System Clock Badge */}
        <div className="px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center gap-2 text-xs font-mono">
          <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <div className="text-white font-bold">{systemTime || 'LIVE'}</div>
            <div className="text-[10px] text-slate-500 font-sans">Tiruchirappalli Grid</div>
          </div>
        </div>
      </div>
    </div>
  );
};
