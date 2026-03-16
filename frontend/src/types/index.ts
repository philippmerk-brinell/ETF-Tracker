export interface ETF {
  id: number;
  ticker: string;
  display_name: string | null;
  added_at: string;
  last_price: number | null;
  ath_price: number | null;
  ath_date: string | null;
  last_checked_at: string | null;
}

export interface SearchResult {
  ticker: string;
  display_name: string;
  exchange: string;
  type: string;
}

export interface HistoryPoint {
  date: string;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: number | null;
}

export interface AlertConfig {
  id: number;
  daily_drop_pct: number;
  weekly_drop_pct: number;
  ath_drop_pct: number;
}

export interface NotificationConfig {
  id: number;
  email_enabled: number;
  email_smtp_host: string;
  email_smtp_port: number;
  email_smtp_user: string;
  email_smtp_password: string;
  email_recipient: string;
  whatsapp_enabled: number;
  whatsapp_to_number: string;
}

export interface AlertLog {
  id: number;
  ticker: string;
  alert_type: 'daily_drop' | 'weekly_drop' | 'ath_drop';
  triggered_at: string;
  value_pct: number;
  threshold_pct: number;
  notified_email: number;
  notified_whatsapp: number;
}

export type Period = '1w' | '1mo' | '3mo' | '6mo' | '1y' | '5y' | 'max';
