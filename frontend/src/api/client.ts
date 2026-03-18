import axios from 'axios';
import type { ETF, SearchResult, HistoryPoint, AlertConfig, NotificationConfig, AlertLog, Period } from '../types';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
});

// ETFs
export const etfApi = {
  list: () => api.get<ETF[]>('/etfs').then(r => r.data),
  search: (q: string) => api.get<SearchResult[]>(`/etfs/search?q=${encodeURIComponent(q)}`).then(r => r.data),
  add: (ticker: string) => api.post<ETF>('/etfs', { ticker }).then(r => r.data),
  remove: (ticker: string) => api.delete(`/etfs/${ticker}`).then(r => r.data),
  refresh: (ticker: string) => api.post<ETF>(`/etfs/${ticker}/refresh`).then(r => r.data),
  history: (ticker: string, period: Period) =>
    api.get<{ ticker: string; period: string; data: HistoryPoint[] }>(`/etfs/${ticker}/history?period=${period}`).then(r => r.data),
};

// Alerts
export const alertApi = {
  getGlobal: () => api.get<AlertConfig>('/alerts/global').then(r => r.data),
  setGlobal: (config: Partial<AlertConfig>) => api.put<AlertConfig>('/alerts/global', config).then(r => r.data),
  getLog: (limit = 50) => api.get<AlertLog[]>(`/alerts/log?limit=${limit}`).then(r => r.data),
  triggerCheck: () => api.post('/alerts/check').then(r => r.data),
};

// Notifications
export const notifApi = {
  getConfig: () => api.get<NotificationConfig>('/notifications/config').then(r => r.data),
  setConfig: (config: Partial<NotificationConfig>) => api.put<NotificationConfig>('/notifications/config', config).then(r => r.data),
  sendTest: () => api.post<{ email: boolean | null; whatsapp: boolean | null }>('/notifications/test').then(r => r.data),
  getWhatsAppStatus: () => api.get<{ status: string }>('/notifications/whatsapp/status').then(r => r.data),
  getWhatsAppQR: () => api.get<{ qr: string; status: string }>('/notifications/whatsapp/qr').then(r => r.data),
};
