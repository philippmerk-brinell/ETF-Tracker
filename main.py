"""
main.py

Entry point for the ETF buy-signal engine.
Runs daily after market close (weekdays). Fetches data, scores signals,
dispatches Make.com webhook alerts when composite scores cross thresholds.

Usage:
    python main.py                      # normal daily run
    python main.py --dry-run            # calculate but don't send alerts or save state
    python main.py --ticker IWDA.AS     # run for a single ETF only
    python main.py --config my.yaml     # use a custom config file
"""
import os
import sys
import argparse
import logging
from datetime import date
from dotenv import load_dotenv
import yaml

from signal_engine.data_fetcher import (
    get_price_data,
    get_vix,
    get_hy_spread,
    get_yield_curve,
    get_fear_greed,
)
from signal_engine.signal_calculator import (
    score_drawdown,
    score_vix,
    score_hy_spread,
    score_rsi,
    score_fear_greed,
    score_sma200,
    score_yield_curve,
    compute_rsi_from_series,
    compute_sma,
)
from signal_engine.signal_aggregator import compute_composite, composite_to_alert_level
from signal_engine.state_manager import init_db, should_alert, save_alert, save_run
from signal_engine.alert_dispatcher import send_webhook


def setup_logging():
    os.makedirs("data", exist_ok=True)
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler("data/signal_engine.log"),
        ],
    )


def load_config(path: str = "config.yaml") -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)


def main():
    setup_logging()
    log = logging.getLogger(__name__)

    # --- CLI args ---
    parser = argparse.ArgumentParser(description="ETF Buy-Signal Engine")
    parser.add_argument("--dry-run", action="store_true",
                        help="Calculate signals but don't send webhooks or save state")
    parser.add_argument("--ticker", type=str,
                        help="Run for a single ticker only (e.g. IWDA.AS)")
    parser.add_argument("--config", type=str, default="config.yaml",
                        help="Path to config YAML file (default: config.yaml)")
    args = parser.parse_args()

    # --- Load credentials ---
    load_dotenv()
    MAKE_WEBHOOK_URL = os.environ.get("MAKE_WEBHOOK_URL", "")

    # --- Load config ---
    config = load_config(args.config)
    etfs = config["etfs"]
    weights = config["signals"]["weights"]
    thresholds = config["signals"]["thresholds"]
    cooldowns = config["alerts"]["cooldowns"]
    webhook_enabled = config["alerts"]["webhook"].get("enabled", True)
    yf_period = config.get("data", {}).get("yfinance_period", "1y")
    sma_window = config.get("data", {}).get("sma_window", 200)
    rsi_window = config.get("data", {}).get("rsi_window", 14)

    # Filter to single ticker if requested
    if args.ticker:
        etfs = [e for e in etfs if e["ticker"].upper() == args.ticker.upper()]
        if not etfs:
            log.error(f"Ticker '{args.ticker}' not found in {args.config}")
            sys.exit(1)

    # --- Init DB ---
    if not args.dry_run:
        init_db()

    run_date = date.today().isoformat()
    log.info(f"=== ETF Signal Engine | {run_date} | {len(etfs)} ETFs | dry_run={args.dry_run} ===")

    # -----------------------------------------------------------------------
    # STEP 1: Batch fetch all price data (single yfinance call)
    # -----------------------------------------------------------------------
    tickers = [e["ticker"] for e in etfs]
    log.info(f"Fetching price data for {len(tickers)} tickers (period={yf_period})...")
    try:
        price_data = get_price_data(tickers, period=yf_period)
        log.info(f"Price data: {len(price_data)}/{len(tickers)} tickers OK")
    except Exception as e:
        log.error(f"Fatal: price data fetch failed: {e}")
        sys.exit(1)

    # -----------------------------------------------------------------------
    # STEP 2: Fetch market-wide macro data (shared across all ETFs)
    # -----------------------------------------------------------------------
    log.info("Fetching macro signals (VIX, HY spread, yield curve, Fear & Greed)...")
    macro = {}

    try:
        vix_val = get_vix()
        macro["vix"] = score_vix(vix_val)
        log.info(f"  VIX:          {vix_val:.1f}  -> score {macro['vix']['score']}")
    except Exception as e:
        log.warning(f"  VIX fetch failed: {e}")

    try:
        hy_val = get_hy_spread()
        macro["hy_spread"] = score_hy_spread(hy_val)
        log.info(f"  HY Spread:    {hy_val:.2f}%  -> score {macro['hy_spread']['score']}")
    except Exception as e:
        log.warning(f"  HY spread fetch failed: {e}")

    try:
        yc_val = get_yield_curve()
        macro["yield_curve"] = score_yield_curve(yc_val)
        log.info(f"  Yield Curve:  {yc_val:.3f}%  -> score {macro['yield_curve']['score']}")
    except Exception as e:
        log.warning(f"  Yield curve fetch failed: {e}")

    try:
        fg_val = get_fear_greed()
        macro["fear_greed"] = score_fear_greed(fg_val)
        log.info(f"  Fear & Greed: {fg_val}  -> score {macro['fear_greed']['score']}")
    except Exception as e:
        log.warning(f"  Fear & Greed fetch failed: {e}")

    # -----------------------------------------------------------------------
    # STEP 3: Per-ETF signal calculation
    # -----------------------------------------------------------------------
    results_summary = []

    for etf_cfg in etfs:
        ticker = etf_cfg["ticker"]
        name = etf_cfg["name"]
        log.info(f"\n--- {ticker} ({name}) ---")

        if ticker not in price_data:
            log.warning(f"  Skipping: no price data")
            continue

        df = price_data[ticker]
        close = df["Close"]
        current_price = float(close.iloc[-1])
        ath_price = float(close.max())

        signals = {}

        # Drawdown from ATH
        signals["drawdown"] = score_drawdown(current_price, ath_price)
        log.info(f"  Drawdown ATH: {signals['drawdown']['value']:.1f}%  -> score {signals['drawdown']['score']}")

        # RSI
        try:
            rsi_val = compute_rsi_from_series(close, window=rsi_window)
            signals["rsi"] = score_rsi(rsi_val)
            log.info(f"  RSI({rsi_window}):        {rsi_val:.1f}  -> score {signals['rsi']['score']}")
        except Exception as e:
            log.warning(f"  RSI failed: {e}")

        # SMA200
        try:
            sma_val = compute_sma(close, window=sma_window)
            signals["sma200"] = score_sma200(current_price, sma_val)
            log.info(f"  vs SMA{sma_window}:   {signals['sma200']['value']:.1f}% below  -> score {signals['sma200']['score']}")
        except Exception as e:
            log.warning(f"  SMA failed: {e}")

        # Merge market-wide macro signals
        for key in ["vix", "hy_spread", "yield_curve", "fear_greed"]:
            if key in macro:
                signals[key] = macro[key]

        # Composite score
        result = compute_composite(signals, weights=weights)
        alert_level = composite_to_alert_level(result["composite_score"], thresholds)
        result["alert_level"] = alert_level

        log.info(f"  Composite: {result['composite_score']:.1f}/100  -> {alert_level.upper()}")
        results_summary.append({
            "ticker": ticker,
            "name": name,
            "score": result["composite_score"],
            "level": alert_level,
        })

        # Save run to DB
        if not args.dry_run:
            save_run(ticker, run_date, result)

        # -----------------------------------------------------------------------
        # STEP 4: Alert dispatch
        # -----------------------------------------------------------------------
        alertable = {"elevated", "strong", "extreme"}
        if alert_level not in alertable:
            log.info(f"  No alert (level={alert_level})")
            continue

        cooldown_hours = cooldowns.get(alert_level, 24)

        if not args.dry_run and not should_alert(ticker, alert_level, cooldown_hours):
            log.info(f"  Alert suppressed: '{alert_level}' already sent within {cooldown_hours}h")
            continue

        # Send webhook to Make.com
        notified = False
        if webhook_enabled and MAKE_WEBHOOK_URL:
            if args.dry_run:
                log.info(f"  [DRY RUN] Would send {alert_level.upper()} webhook for {ticker} (score={result['composite_score']:.1f})")
            else:
                notified = send_webhook(ticker, name, result, alert_level, MAKE_WEBHOOK_URL)
                log.info(f"  Webhook: {'OK' if notified else 'FAILED'}")
        else:
            log.warning(f"  Webhook not configured — set MAKE_WEBHOOK_URL in .env")

        if not args.dry_run:
            save_alert(ticker, alert_level, result["composite_score"], notified)

    # -----------------------------------------------------------------------
    # Summary
    # -----------------------------------------------------------------------
    log.info("\n=== Summary ===")
    log.info(f"  {'Ticker':<12} {'Score':>7}  Level")
    log.info(f"  {'-' * 32}")
    for r in sorted(results_summary, key=lambda x: x["score"], reverse=True):
        log.info(f"  {r['ticker']:<12} {r['score']:>7.1f}  {r['level']}")
    log.info("=== Done ===\n")


if __name__ == "__main__":
    main()
