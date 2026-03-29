"""
alert_dispatcher.py

Sends alert payloads to Make.com webhook.
Make.com routes to WhatsApp (via Twilio or WhatsApp Cloud API module).
"""
import requests
from datetime import datetime, timezone


def build_payload(ticker: str, name: str, result: dict, level: str) -> dict:
    """
    Build the JSON payload sent to Make.com.

    Make.com receives this and formats a WhatsApp message. The payload
    is structured so Make.com can easily template the message with
    individual signal values without needing to parse nested JSON.

    Structure:
    {
        "ticker": "IWDA.AS",
        "name": "iShares Core MSCI World Acc",
        "alert_level": "strong",
        "alert_label": "STRONG BUY SIGNAL",
        "composite_score": 71.4,
        "timestamp": "2025-03-14 22:05 UTC",
        "signals": {
            "drawdown":    {"value": 18.5, "score": 66.0, "level": "buy"},
            "vix":         {"value": 32.1, "score": 72.0, "level": "buy"},
            ...
        },
        "message_text": "pre-formatted plain text for WhatsApp"
    }
    """
    level_labels = {
        "elevated": "Elevated — Buy Opportunity",
        "strong":   "Strong Buy Signal",
        "extreme":  "EXTREME Buy Signal",
    }
    level_emoji = {
        "elevated": "⚠️",
        "strong":   "🚨",
        "extreme":  "🔴",
    }

    signals = result["signals"]
    composite = result["composite_score"]
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    # Pre-formatted plain text for WhatsApp (no markdown, clear layout)
    signal_lines = []
    display = {
        "drawdown":    ("Drawdown from ATH", lambda v: f"-{v:.1f}%"),
        "vix":         ("VIX",               lambda v: f"{v:.1f}"),
        "hy_spread":   ("HY Spread",         lambda v: f"{v:.2f}%"),
        "rsi":         ("RSI(14)",            lambda v: f"{v:.1f}"),
        "fear_greed":  ("Fear & Greed",      lambda v: str(int(v))),
        "sma200":      ("vs SMA200",         lambda v: f"-{v:.1f}%"),
        "yield_curve": ("Yield Curve 10Y-2Y",lambda v: f"{v:.2f}%"),
    }
    for key, (label, fmt) in display.items():
        if key in signals:
            s = signals[key]
            bar_filled = round(s["score"] / 100 * 8)
            bar = "█" * bar_filled + "░" * (8 - bar_filled)
            signal_lines.append(f"  {label}: {fmt(s['value'])}  [{bar}] {s['score']:.0f}/100")

    score_bar_filled = round(composite / 100 * 10)
    score_bar = "█" * score_bar_filled + "░" * (10 - score_bar_filled)

    message_text = (
        f"{level_emoji.get(level, '📊')} *{level_labels.get(level, level.upper())}*\n"
        f"{ticker} — {name}\n\n"
        f"Composite Score: {composite:.1f}/100\n"
        f"[{score_bar}] {composite:.0f}%\n\n"
        f"Signal Breakdown:\n"
        + "\n".join(signal_lines)
        + f"\n\n🕐 {timestamp}"
    )

    return {
        "ticker": ticker,
        "name": name,
        "alert_level": level,
        "alert_label": level_labels.get(level, level.upper()),
        "composite_score": composite,
        "timestamp": timestamp,
        "signals": signals,
        "message_text": message_text,
    }


def send_webhook(ticker: str, name: str, result: dict, level: str, webhook_url: str) -> bool:
    """
    POST alert payload to Make.com webhook.
    Returns True on HTTP 2xx, False on any error.
    """
    payload = build_payload(ticker, name, result, level)

    try:
        resp = requests.post(webhook_url, json=payload, timeout=15)
        if resp.status_code < 300:
            return True
        else:
            print(f"[dispatcher] Webhook error {resp.status_code}: {resp.text[:200]}")
            return False
    except requests.RequestException as e:
        print(f"[dispatcher] Webhook request failed: {e}")
        return False
