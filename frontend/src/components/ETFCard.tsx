import type { ETF, AlertConfig } from '../types';

interface Props {
  etf: ETF;
  alertConfig: AlertConfig | null;
  selected: boolean;
  onClick: () => void;
  onRemove: () => void;
  onRefresh: () => void;
}

function pct(value: number | null, total: number | null): number | null {
  if (value == null || total == null || total === 0) return null;
  return ((total - value) / total) * 100;
}

export default function ETFCard({ etf, alertConfig, selected, onClick, onRemove, onRefresh }: Props) {
  const athGap = pct(etf.last_price, etf.ath_price);
  const athThreshold = alertConfig?.ath_drop_pct ?? 10;

  const isAthWarning = athGap != null && athGap >= athThreshold;

  return (
    <div
      onClick={onClick}
      className={`card cursor-pointer transition-all hover:border-blue-600 ${selected ? 'border-blue-500 ring-1 ring-blue-500' : ''}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="font-mono text-xs text-blue-400 font-semibold">{etf.ticker}</div>
          <div className="text-sm text-gray-200 truncate mt-0.5">{etf.display_name || etf.ticker}</div>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={e => { e.stopPropagation(); onRefresh(); }}
            title="Preis aktualisieren"
            className="text-gray-500 hover:text-blue-400 p-1 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={e => { e.stopPropagation(); onRemove(); }}
            title="Entfernen"
            className="text-gray-500 hover:text-red-400 p-1 rounded transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <div className="text-xl font-bold text-white mb-2">
        {etf.last_price != null ? etf.last_price.toFixed(2) : '—'}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {athGap != null && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isAthWarning ? 'bg-red-900/60 text-red-300' : 'bg-gray-800 text-gray-400'}`}>
            {athGap.toFixed(1)}% unter ATH
          </span>
        )}
        {etf.ath_price != null && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-800 text-gray-400">
            ATH: {etf.ath_price.toFixed(2)}
          </span>
        )}
      </div>

      {etf.last_checked_at && (
        <div className="text-xs text-gray-600 mt-2">
          Geprüft: {new Date(etf.last_checked_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      )}
    </div>
  );
}
