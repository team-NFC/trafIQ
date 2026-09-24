import React, { useState } from 'react';
import { Search, Sparkles } from 'lucide-react';

interface PlateSearchBoxProps {
  initialValue?: string;
  onSearch: (plate: string) => void;
  isLoading?: boolean;
}

export const PlateSearchBox: React.FC<PlateSearchBoxProps> = ({
  initialValue = 'TN45BB7890',
  onSearch,
  isLoading
}) => {
  const [query, setQuery] = useState(initialValue);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const samplePlates = ['TN45BB7890', 'DL01AB1234', 'MH12DE5678', 'KA03HA4521'];

  return (
    <div className="rounded-xl border border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-[#0a0f1d] to-purple-950/20 p-5 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold uppercase tracking-wider text-purple-300 flex items-center gap-2">
            <Search className="w-4 h-4 text-purple-400" />
            <span>Search Registration Number</span>
          </h3>
          <p className="text-xs text-slate-400">
            Query city-wide ANPR database to reconstruct multi-camera trajectory and alert status.
          </p>
        </div>

        {/* Quick Sample suggestions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] text-slate-400 font-semibold uppercase">Suggestions:</span>
          {samplePlates.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => {
                setQuery(p);
                onSearch(p);
              }}
              className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-900 border border-purple-800/40 text-purple-300 hover:border-purple-500 transition cursor-pointer"
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex gap-2.5">
        <div className="relative flex-1">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="e.g. TN45BB7890"
            className="w-full h-12 pl-4 pr-12 rounded-xl bg-slate-950 border border-slate-700 text-white font-mono text-base tracking-widest uppercase placeholder:text-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 shadow-inner"
          />
          <div className="absolute right-3.5 top-3.5 text-slate-500">
            <Sparkles className="w-5 h-5 text-purple-400/60" />
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading || !query.trim()}
          className="px-6 h-12 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-purple-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Search className="w-4 h-4" />
          <span>{isLoading ? 'Searching...' : 'Trace Vehicle'}</span>
        </button>
      </form>
    </div>
  );
};
