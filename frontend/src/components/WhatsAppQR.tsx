import { useState, useEffect } from 'react';
import { notifApi } from '../api/client';

export default function WhatsAppQR() {
  const [status, setStatus] = useState<string>('disconnected');
  const [qr, setQR] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const poll = async () => {
    try {
      const s = await notifApi.getWhatsAppStatus();
      setStatus(s.status);
      if (s.status === 'qr_ready') {
        const res = await notifApi.getWhatsAppQR();
        setQR(res.qr);
      } else {
        setQR(null);
      }
    } catch {
      // backend might not be ready
    }
  };

  useEffect(() => {
    poll();
    const interval = setInterval(poll, 5000);
    return () => clearInterval(interval);
  }, []);

  const statusLabel: Record<string, { text: string; color: string }> = {
    disconnected: { text: 'Getrennt', color: 'text-red-400' },
    qr_ready: { text: 'QR-Code bereit (Scannen)', color: 'text-yellow-400' },
    connected: { text: 'Verbunden', color: 'text-green-400' },
  };

  const s = statusLabel[status] || { text: status, color: 'text-gray-400' };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className={`w-2 h-2 rounded-full ${status === 'connected' ? 'bg-green-500' : status === 'qr_ready' ? 'bg-yellow-500' : 'bg-red-500'}`} />
        <span className={`text-sm font-medium ${s.color}`}>{s.text}</span>
      </div>

      {status === 'qr_ready' && qr && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">
            Öffne WhatsApp auf deinem Handy → Verknüpfte Geräte → Gerät verknüpfen → QR-Code scannen:
          </p>
          <div className="bg-white p-3 rounded-lg inline-block">
            <img src={qr} alt="WhatsApp QR Code" className="w-48 h-48" />
          </div>
        </div>
      )}

      {status === 'connected' && (
        <p className="text-xs text-green-400">
          WhatsApp ist verbunden. Benachrichtigungen können gesendet werden.
        </p>
      )}

      {status === 'disconnected' && (
        <p className="text-xs text-gray-500">
          Der WhatsApp-Client startet... Warte auf QR-Code (kann bis zu 30 Sekunden dauern).
        </p>
      )}
    </div>
  );
}
