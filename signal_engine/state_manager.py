"""
state_manager.py

SQLite persistence:
- signal_runs: every daily calculation result per ETF (for history/debugging)
- alert_history: deduplication — prevents re-alerting the same level within cooldown
"""
import sqlite3
import json
import os
from datetime import datetime, timedelta, timezone

DB_PATH = os.environ.get("DB_PATH", "data/signal_state.db")


def _get_conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """Create tables if they don't exist. Called once at startup."""
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    with _get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS signal_runs (
                id                    INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker                TEXT NOT NULL,
                run_date              TEXT NOT NULL,
                composite_score       REAL NOT NULL,
                alert_level           TEXT NOT NULL,
                signal_breakdown_json TEXT NOT NULL,
                created_at            TEXT DEFAULT (datetime('now', 'utc')),
                UNIQUE(ticker, run_date)
            );

            CREATE TABLE IF NOT EXISTS alert_history (
                id              INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker          TEXT NOT NULL,
                alert_level     TEXT NOT NULL,
                composite_score REAL NOT NULL,
                notified        INTEGER NOT NULL DEFAULT 0,
                triggered_at    TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
            );

            CREATE INDEX IF NOT EXISTS idx_alert_history_ticker_level
                ON alert_history (ticker, alert_level, triggered_at);

            CREATE INDEX IF NOT EXISTS idx_signal_runs_ticker_date
                ON signal_runs (ticker, run_date);
        """)


def should_alert(ticker: str, level: str, cooldown_hours: int) -> bool:
    """
    Returns True if no successful alert was sent for this ticker+level
    within the cooldown window. Failed sends (notified=0) don't suppress retries.
    """
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=cooldown_hours)).isoformat()

    with _get_conn() as conn:
        row = conn.execute("""
            SELECT id FROM alert_history
            WHERE ticker = ? AND alert_level = ? AND notified = 1
              AND triggered_at > ?
            ORDER BY triggered_at DESC LIMIT 1
        """, (ticker, level, cutoff)).fetchone()

    return row is None


def save_alert(ticker: str, level: str, composite_score: float, notified: bool) -> None:
    """Record an alert attempt. Call AFTER the webhook/notification attempt."""
    with _get_conn() as conn:
        conn.execute("""
            INSERT INTO alert_history (ticker, alert_level, composite_score, notified)
            VALUES (?, ?, ?, ?)
        """, (ticker, level, composite_score, 1 if notified else 0))


def save_run(ticker: str, run_date: str, result: dict) -> None:
    """
    Persist full daily calculation result. Upserts on (ticker, run_date) so
    re-running on the same day overwrites rather than duplicates.
    """
    with _get_conn() as conn:
        conn.execute("""
            INSERT INTO signal_runs
                (ticker, run_date, composite_score, alert_level, signal_breakdown_json)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(ticker, run_date) DO UPDATE SET
                composite_score = excluded.composite_score,
                alert_level = excluded.alert_level,
                signal_breakdown_json = excluded.signal_breakdown_json,
                created_at = datetime('now', 'utc')
        """, (
            ticker,
            run_date,
            result["composite_score"],
            result["alert_level"],
            json.dumps(result["signals"], default=str),
        ))
