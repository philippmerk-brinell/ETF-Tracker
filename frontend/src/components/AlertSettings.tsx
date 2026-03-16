import { useState, useEffect } from 'react';
import { alertApi } from '../api/client';
import type { AlertConfig } from '../types';

export default function AlertSettings() {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const [form, setForm] = useState({ daily_drop_pct: '3', weekly_drop_pct: '5', ath_drop_pct: '10' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    alertApi.getGlobal().then(cfg => {
      setConfig(cfg);
      setForm({
        daily_drop_pct: String(cfg.daily_drop_pct),
        weekly_drop_pct: String(cfg.weekly_drop_pct),
        ath_drop_pct: String(cfg.ath_drop_pct),
      });
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await alertApi.setGlobal({
        daily_drop_pct: parseFloat(form.daily_drop_pct),
        weekly_drop_pct: parseFloat(form.weekly_drop_pct),
        ath_drop_pct: parseFloat(form.ath_drop_pct),
      });
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleManualCheck = async () => {
    setChecking(true);
    try {
      await alertApi.triggerCheck();
    } finally {
      setTimeout(() => setChecking(false), 2000);
    }
  };

  return (
    <div className="card space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-semibold text-base">Alert-Schwellenwerte (Global)</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Tagesfall-Alarm (%)</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="input"
              value={form.daily_drop_pct}
              onChange={e => setForm(f => ({ ...f, daily_drop_pct: e.target.value }))}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Benachrichtigung wenn ein ETF an einem Tag mehr als {form.daily_drop_pct}% fällt
          </p>
        </div>

        <div>
          <label className="label">Wochenfall-Alarm (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="input"
            value={form.weekly_drop_pct}
            onChange={e => setForm(f => ({ ...f, weekly_drop_pct: e.target.value }))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Benachrichtigung wenn ein ETF in 7 Tagen mehr als {form.weekly_drop_pct}% fällt
          </p>
        </div>

        <div>
          <label className="label">ATH-Abstand-Alarm (%)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            max="100"
            className="input"
            value={form.ath_drop_pct}
            onChange={e => setForm(f => ({ ...f, ath_drop_pct: e.target.value }))}
          />
          <p className="text-xs text-gray-500 mt-1">
            Benachrichtigung wenn ein ETF mehr als {form.ath_drop_pct}% unter seinem All-Time-High liegt
          </p>
        </div>
      </div>

      <div className="flex gap-3 flex-wrap">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Speichert...' : saved ? 'Gespeichert!' : 'Speichern'}
        </button>
        <button onClick={handleManualCheck} disabled={checking} className="btn-secondary">
          {checking ? 'Prüfe...' : 'Jetzt prüfen'}
        </button>
      </div>

      {config && (
        <p className="text-xs text-gray-600">
          Aktiv: Tagesfall &gt;{config.daily_drop_pct}% · Wochenfall &gt;{config.weekly_drop_pct}% · ATH-Abstand &gt;{config.ath_drop_pct}%
        </p>
      )}
    </div>
  );
}
