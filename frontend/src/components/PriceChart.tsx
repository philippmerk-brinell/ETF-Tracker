import { useState, useEffect } from 'react';
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine,
} from 'recharts';
import { etfApi } from '../api/client';
import type { ETF, HistoryPoint, Period } from '../types';

interface Props {
  etf: ETF;
}

const PERIODS: { label: string; value: Period }[] = [
  { label: '1W', value: '1w' },
  { label: '1M', value: '1mo' },
  { label: '3M', value: '3mo' },
  { label: '6M', value: '6mo' },
  { label: '1J', value: '1y' },
  { label: '5J', value: '5y' },
  { label: 'Max', value: 'max' },
];

function formatDate(dateStr: string, period: Period) {
  const d = new Date(dateStr);
  if (period === '1w' || period === '1mo') return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
  if (period === '5y' || period === 'max') return d.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
}

export default function PriceChart({ etf }: Props) {
  const [period, setPeriod] = useState<Period>('1y');
  const [data, setData] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!etf) return;
    setLoading(true);
    setError(null);
    etfApi.history(etf.ticker, period)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || err.message))
      .finally(() => setLoading(false));
  }, [etf, period]);

  const isPositive = data.length >= 2
    ? (data[data.length - 1].close ?? 0) >= (data[0].close ?? 0)
    : true;

  const color = isPositive ? '#22c55e' : '#ef4444';

  const chartData = data.map(d => ({
    date: d.date,
    close: d.close != null ? parseFloat(d.close.toFixed(2)) : null,
  }));

  const minVal = Math.min(...chartData.map(d => d.close ?? Infinity)) * 0.998;
  const maxVal = Math.max(...chartData.map(d => d.close ?? -Infinity)) * 1.002;

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h2 className="text-white font-semibold">{etf.display_name || etf.ticker}</h2>
          <div className="text-xs text-gray-500 font-mono">{etf.ticker}</div>
        </div>
        <div className="flex gap-1">
          {PERIODS.map(p => (
            <button
              key={p.value}
              onClick={() => setPeriod(p.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                period === p.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="h-64 flex items-center justify-center text-gray-500">
          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {error && (
        <div className="h-64 flex items-center justify-center text-red-400 text-sm">
          Fehler: {error}
        </div>
      )}

      {!loading && !error && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={chartData} margin={{ top: 5, right: 5, bottom: 5, left: 10 }}>
            <defs>
              <linearGradient id={`grad-${etf.ticker}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="date"
              tickFormatter={d => formatDate(d, period)}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[minVal, maxVal]}
              tick={{ fill: '#6b7280', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={v => v.toFixed(0)}
              width={55}
            />
            <Tooltip
              contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '8px' }}
              labelStyle={{ color: '#9ca3af', fontSize: 12 }}
              itemStyle={{ color: '#e5e7eb', fontSize: 13 }}
              formatter={(val: number) => [val.toFixed(2), 'Kurs']}
              labelFormatter={d => new Date(d).toLocaleDateString('de-DE', { dateStyle: 'medium' })}
            />
            {etf.ath_price && (
              <ReferenceLine
                y={etf.ath_price}
                stroke="#f59e0b"
                strokeDasharray="4 4"
                label={{ value: 'ATH', fill: '#f59e0b', fontSize: 11, position: 'right' }}
              />
            )}
            <Area
              type="monotone"
              dataKey="close"
              stroke={color}
              strokeWidth={2}
              fill={`url(#grad-${etf.ticker})`}
              dot={false}
              connectNulls
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!loading && !error && chartData.length === 0 && (
        <div className="h-64 flex items-center justify-center text-gray-500 text-sm">
          Keine Daten verfügbar
        </div>
      )}
    </div>
  );
}
