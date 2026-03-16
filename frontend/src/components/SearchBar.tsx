import { useState, useEffect, useRef } from 'react';
import { etfApi } from '../api/client';
import type { SearchResult } from '../types';

interface Props {
  onAdd: (ticker: string) => Promise<void>;
  loading: boolean;
}

export default function SearchBar({ onAdd, loading }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.trim().length < 1) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await etfApi.search(query);
        setResults(res.slice(0, 8));
        setOpen(true);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, [query]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = async (ticker: string) => {
    setOpen(false);
    setQuery('');
    await onAdd(ticker);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="relative">
        <input
          type="text"
          className="input pr-10"
          placeholder="ETF suchen (z.B. MSCI World, SPY, IWDA.AS)"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
        />
        {(searching || loading) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-gray-800 border border-gray-700 rounded-xl shadow-xl overflow-hidden">
          {results.map(r => (
            <button
              key={r.ticker}
              onClick={() => handleSelect(r.ticker)}
              className="w-full text-left px-4 py-3 hover:bg-gray-700 transition-colors flex items-center gap-3 border-b border-gray-700 last:border-0"
            >
              <div className="flex-1 min-w-0">
                <div className="font-mono text-sm text-blue-400">{r.ticker}</div>
                <div className="text-sm text-gray-300 truncate">{r.display_name}</div>
              </div>
              <div className="text-xs text-gray-500 shrink-0">{r.exchange}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
