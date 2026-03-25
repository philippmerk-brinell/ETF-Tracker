const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/etf-tracker.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS etfs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT UNIQUE NOT NULL,
      display_name TEXT,
      added_at TEXT DEFAULT (datetime('now')),
      last_price REAL,
      change_pct REAL,
      ath_price REAL,
      ath_date TEXT,
      last_checked_at TEXT
    );

    CREATE TABLE IF NOT EXISTS alert_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      daily_drop_pct REAL NOT NULL DEFAULT 3.0,
      weekly_drop_pct REAL NOT NULL DEFAULT 5.0,
      ath_drop_pct REAL NOT NULL DEFAULT 10.0
    );

    CREATE TABLE IF NOT EXISTS notification_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      email_enabled INTEGER NOT NULL DEFAULT 0,
      email_smtp_host TEXT DEFAULT '',
      email_smtp_port INTEGER DEFAULT 587,
      email_smtp_user TEXT DEFAULT '',
      email_smtp_password TEXT DEFAULT '',
      email_recipient TEXT DEFAULT '',
      whatsapp_enabled INTEGER NOT NULL DEFAULT 0,
      whatsapp_to_number TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS alert_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticker TEXT NOT NULL,
      alert_type TEXT NOT NULL,
      triggered_at TEXT DEFAULT (datetime('now')),
      value_pct REAL,
      threshold_pct REAL,
      notified_email INTEGER DEFAULT 0,
      notified_whatsapp INTEGER DEFAULT 0
    );
  `);

  // Migrate: add change_pct column if missing (for existing DBs)
  const cols = db.prepare("PRAGMA table_info(etfs)").all().map(c => c.name);
  if (!cols.includes('change_pct')) {
    db.exec('ALTER TABLE etfs ADD COLUMN change_pct REAL');
  }

  // Insert default rows if not present
  db.prepare(`
    INSERT OR IGNORE INTO alert_config (id, daily_drop_pct, weekly_drop_pct, ath_drop_pct)
    VALUES (1, 3.0, 5.0, 10.0)
  `).run();

  db.prepare(`
    INSERT OR IGNORE INTO notification_config (id) VALUES (1)
  `).run();

  console.log('Database initialized at', DB_PATH);
}

initDatabase();

module.exports = db;
