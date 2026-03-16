import { useState, useEffect, useCallback } from 'react';
import { etfApi, alertApi } from '../api/client';
import type { ETF, AlertConfig } from '../types';
import SearchBar from '../components/SearchBar';
import ETFCard from '../components/ETFCard';
import PriceChart from '../components/PriceChart';

export default function Dashboard() {
  const [etfs, setEtfs] = useState<ETF[]>([]);
  const [alertConfig, setAlertConfig] = useState<AlertConfig | null>(null);
  const [selected, setSelected] = useState<ETF | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadEtfs = useCallback(async () => {
    const data = await etfApi.list();
    setEtfs(data);
    if (!selected && data.length > 0) setSelected(data[0]);
  }, [selected]);

  useEffect(() => {
    loadEtfs().catch(console.error);
    alertApi.getGlobal().then(setAlertConfig).catch(console.error);
  }, []);

  const handleAdd = async (ticker: string) => {
    setLoading(true);
    setError(null);
    try {
      const etf = await etfApi.add(ticker);
      setEtfs(prev => [etf, ...prev]);
      setSelected(etf);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message);
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (ticker: string) => {
    await etfApi.remove(ticker);
    setEtfs(prev => {
      const next = prev.filter(e => e.ticker !== ticker);
      if (selected?.ticker === ticker) setSelected(next[0] || null);
      return next;
    });
  };

  const handleRefresh = async (ticker: string) => {
    const updated = await etfApi.refresh(ticker);
    setEtfs(prev => prev.map(e => e.ticker === ticker ? updated : e));
    if (selected?.ticker === ticker) setSelected(updated);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 flex-wrap">
        <SearchBar onAdd={handleAdd} loading={loading} />
        {error && (
          <div className="text-red-400 text-sm bg-red-900/20 px-3 py-2 rounded-lg border border-red-800">
            {error}
          </div>
        )}
      </div>

      {etfs.length === 0 ? (
        <div className="text-center py-20 text-gray-500">
          <div className="text-4xl mb-4">📊</div>
          <p className="text-lg font-medium text-gray-400 mb-1">Noch keine ETFs hinzugefügt</p>
          <p className="text-sm">Suche oben nach einem Ticker-Symbol (z.B. IWDA.AS, SPY, QQQ)</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          {/* Watchlist */}
          <div className="xl:col-span-1 space-y-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
              Watchlist ({etfs.length})
            </h2>
            {etfs.map(etf => (
              <ETFCard
                key={etf.ticker}
                etf={etf}
                alertConfig={alertConfig}
                selected={selected?.ticker === etf.ticker}
                onClick={() => setSelected(etf)}
                onRemove={() => handleRemove(etf.ticker)}
                onRefresh={() => handleRefresh(etf.ticker)}
              />
            ))}
          </div>

          {/* Chart */}
          <div className="xl:col-span-3">
            {selected ? (
              <PriceChart etf={selected} />
            ) : (
              <div className="card h-80 flex items-center justify-center text-gray-500">
                Wähle einen ETF aus der Liste
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
