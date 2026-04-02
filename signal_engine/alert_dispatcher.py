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
        f"{level_emoji.get(level, '📊')} <b>{level_labels.get(level, level.upper())}</b>\n"
        f"{ticker} — {name}\n\n"
        f"Composite Score: {composite:.1f}/100\n"
        f"[{score_bar}] {composite:.0f}%\n\n"
        f"<b>Signal Breakdown:</b>\n"
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


def send_telegram(message_text: str, bot_token: str, chat_id: str) -> bool:
    """
    Send message via Telegram Bot API (free, no third party).
    Get bot_token from @BotFather, chat_id from getUpdates after messaging your bot.
    """
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    try:
        resp = requests.post(url, json={
            "chat_id": chat_id,
            "text": message_text,
            "parse_mode": "HTML",
        }, timeout=15)
        if resp.status_code < 300:
            return True
        print(f"[dispatcher] Telegram error {resp.status_code}: {resp.text[:200]}")
        return False
    except requests.RequestException as e:
        print(f"[dispatcher] Telegram request failed: {e}")
        return False


def send_callmebot(message_text: str, phone: str, api_key: str) -> bool:
    """
    Send WhatsApp message via CallMeBot (free).
    Register at callmebot.com: save +34 644 60 78 85 as a contact,
    send 'I allow callmebot to send me messages' on WhatsApp to get your API key.
    phone: international format without + (e.g. 49171xxxxxxx)
    """
    import urllib.parse
    encoded = urllib.parse.quote(message_text)
    url = f"https://api.callmebot.com/whatsapp.php?phone={phone}&text={encoded}&apikey={api_key}"
    try:
        resp = requests.get(url, timeout=15)
        if resp.status_code < 300:
            return True
        print(f"[dispatcher] CallMeBot error {resp.status_code}: {resp.text[:200]}")
        return False
    except requests.RequestException as e:
        print(f"[dispatcher] CallMeBot request failed: {e}")
        return False


def send_daily_digest(results_summary: list, macro: dict, bot_token: str, chat_id: str) -> bool:
    """
    Send a daily summary of all ETF scores to Telegram.
    Fires unconditionally once per run — used for testing and daily awareness
    before the alert thresholds are calibrated.

    results_summary: list of {"ticker", "name", "score", "level"} dicts (sorted by score)
    macro: dict with keys "vix", "hy_spread", "yield_curve", "fear_greed" — each with "value" and "score"
    """
    from datetime import datetime, timezone
    timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    level_icons = {
        "extreme":  "🔴",
        "strong":   "🚨",
        "elevated": "⚠️",
        "monitor":  "👀",
        "no_action": "✅",
    }

    rows = []
    for r in results_summary:
        icon = level_icons.get(r["level"], "•")
        chart_url = f"https://finance.yahoo.com/chart/{r['ticker']}"
        short_name = r.get("short_name", r["ticker"])
        level_label = r["level"].replace("_", " ")
        rows.append(f'{icon} <a href="{chart_url}">{short_name}</a>  {r["score"]:.1f}  {level_label}')

    macro_lines = []
    if "vix" in macro:
        macro_lines.append(f"  VIX:          {macro['vix']['value']:.1f}  (score {macro['vix']['score']:.0f})")
    if "hy_spread" in macro:
        macro_lines.append(f"  HY Spread:    {macro['hy_spread']['value']:.2f}%  (score {macro['hy_spread']['score']:.0f})")
    if "yield_curve" in macro:
        macro_lines.append(f"  Yield Curve:  {macro['yield_curve']['value']:.3f}%  (score {macro['yield_curve']['score']:.0f})")
    if "fear_greed" in macro:
        macro_lines.append(f"  Fear & Greed: {int(macro['fear_greed']['value'])}  (score {macro['fear_greed']['score']:.0f})")

    message = (
        f"📊 <b>ETF Daily Digest — {timestamp}</b>\n\n"
        + "\n".join(rows)
        + "\n\n<b>Macro:</b>\n"
        + "\n".join(macro_lines)
        + "\n\n<b>Score Guide:</b>\n"
        + "  ✅ 0–29   No action — market calm\n"
        + "  👀 30–49  Monitor — mild stress\n"
        + "  ⚠️ 50–64  Elevated — reasonable entry\n"
        + "  🚨 65–79  Strong — historically good zone\n"
        + "  🔴 80+    Extreme — rare max opportunity"
    )

    return send_telegram(message, bot_token, chat_id)
