import { useState, useEffect } from 'react';
import { notifApi } from '../api/client';
import type { NotificationConfig } from '../types';
import WhatsAppQR from './WhatsAppQR';

export default function NotifSettings() {
  const [config, setConfig] = useState<NotificationConfig | null>(null);
  const [form, setForm] = useState<Partial<NotificationConfig>>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testResult, setTestResult] = useState<{ email: boolean; whatsapp: boolean } | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    notifApi.getConfig().then(cfg => {
      setConfig(cfg);
      setForm(cfg);
    }).catch(console.error);
  }, []);

  const update = (key: keyof NotificationConfig, value: string | number | boolean) => {
    setForm(f => ({ ...f, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const updated = await notifApi.setConfig(form);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await notifApi.sendTest();
      setTestResult(result);
    } catch {
      setTestResult({ email: false, whatsapp: false });
    } finally {
      setTesting(false);
    }
  };

  if (!config) return <div className="card text-gray-500 text-sm">Lade Einstellungen...</div>;

  return (
    <div className="space-y-6">
      {/* Email */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold">E-Mail Benachrichtigungen</h3>
          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.email_enabled}
              onChange={e => update('email_enabled', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-400">Aktiviert</span>
          </label>
        </div>

        {!!form.email_enabled && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="label">SMTP Host</label>
              <input
                className="input"
                placeholder="smtp.gmail.com"
                value={form.email_smtp_host || ''}
                onChange={e => update('email_smtp_host', e.target.value)}
              />
            </div>
            <div>
              <label className="label">SMTP Port</label>
              <input
                className="input"
                type="number"
                placeholder="587"
                value={form.email_smtp_port || 587}
                onChange={e => update('email_smtp_port', parseInt(e.target.value))}
              />
            </div>
            <div>
              <label className="label">Benutzername</label>
              <input
                className="input"
                placeholder="user@gmail.com"
                value={form.email_smtp_user || ''}
                onChange={e => update('email_smtp_user', e.target.value)}
              />
            </div>
            <div>
              <label className="label">Passwort / App-Passwort</label>
              <input
                className="input"
                type="password"
                placeholder="App-Passwort"
                value={form.email_smtp_password || ''}
                onChange={e => update('email_smtp_password', e.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Empfänger-E-Mail</label>
              <input
                className="input"
                placeholder="alerts@example.com"
                value={form.email_recipient || ''}
                onChange={e => update('email_recipient', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <h3 className="text-white font-semibold">WhatsApp Benachrichtigungen</h3>
          <label className="flex items-center gap-2 ml-auto cursor-pointer">
            <input
              type="checkbox"
              checked={!!form.whatsapp_enabled}
              onChange={e => update('whatsapp_enabled', e.target.checked)}
              className="w-4 h-4 rounded accent-blue-500"
            />
            <span className="text-sm text-gray-400">Aktiviert</span>
          </label>
        </div>

        {!!form.whatsapp_enabled && (
          <>
            <div>
              <label className="label">Empfänger-Nummer (mit Ländervorwahl, ohne +)</label>
              <input
                className="input"
                placeholder="4917612345678"
                value={form.whatsapp_to_number || ''}
                onChange={e => update('whatsapp_to_number', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">z.B. 4917612345678 (für +49 176 12345678)</p>
            </div>
            <div className="p-4 bg-gray-800 rounded-lg border border-gray-700">
              <WhatsAppQR />
            </div>
            <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-3 text-xs text-yellow-300">
              <strong>Hinweis:</strong> whatsapp-web.js ist inoffiziell und verstößt gegen WhatsApp AGB.
              Verwendung auf eigenes Risiko.
            </div>
          </>
        )}
      </div>

      {/* Save + Test */}
      <div className="flex gap-3 flex-wrap items-center">
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? 'Speichert...' : saved ? 'Gespeichert!' : 'Speichern'}
        </button>
        <button onClick={handleTest} disabled={testing} className="btn-secondary">
          {testing ? 'Sende...' : 'Test-Nachricht senden'}
        </button>

        {testResult && (
          <div className="text-sm text-gray-300">
            E-Mail: {testResult.email ? '✓' : '✗'} · WhatsApp: {testResult.whatsapp ? '✓' : '✗'}
          </div>
        )}
      </div>
    </div>
  );
}
