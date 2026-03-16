import { useState, useEffect } from 'react';
import { alertApi } from '../api/client';
import type { AlertLog as AlertLogType } from '../types';

const TYPE_LABELS: Record<string, string> = {
  daily_drop: 'Tagesfall',
  weekly_drop: 'Wochenfall',
  ath_drop: 'ATH-Abstand',
};

export default function AlertLog() {
  const [logs, setLogs] = useState<AlertLogType[]>([]);

  useEffect(() => {
    alertApi.getLog(20).then(setLogs).catch(console.error);
  }, []);

  if (!logs.length) {
    return (
      <div className="card">
        <h3 className="text-white font-semibold mb-3">Alert-Historie</h3>
        <p className="text-gray-500 text-sm">Noch keine Alerts ausgelöst.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="text-white font-semibold mb-4">Alert-Historie</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 text-xs border-b border-gray-800">
              <th className="text-left pb-2 pr-4">ETF</th>
              <th className="text-left pb-2 pr-4">Typ</th>
              <th className="text-right pb-2 pr-4">Wert</th>
              <th className="text-right pb-2 pr-4">Schwelle</th>
              <th className="text-left pb-2 pr-4">Zeitpunkt</th>
              <th className="text-center pb-2">Notif</th>
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                <td className="py-2 pr-4 font-mono text-blue-400 text-xs">{log.ticker}</td>
                <td className="py-2 pr-4 text-gray-300">{TYPE_LABELS[log.alert_type] || log.alert_type}</td>
                <td className="py-2 pr-4 text-right text-red-400">{log.value_pct?.toFixed(2)}%</td>
                <td className="py-2 pr-4 text-right text-gray-500">{log.threshold_pct?.toFixed(2)}%</td>
                <td className="py-2 pr-4 text-gray-400 text-xs">
                  {new Date(log.triggered_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                </td>
                <td className="py-2 text-center text-xs">
                  <span title="E-Mail">{log.notified_email ? '✉️' : '·'}</span>
                  {' '}
                  <span title="WhatsApp">{log.notified_whatsapp ? '💬' : '·'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
