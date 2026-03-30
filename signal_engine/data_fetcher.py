"""
data_fetcher.py

All raw market data acquisition. No calculations here.
Raises on failure — callers handle gracefully in main.py.
"""
import os
import yfinance as yf
import pandas as pd
from fredapi import Fred
import fear_greed
from dotenv import load_dotenv

load_dotenv()


def _get_fred() -> Fred:
    api_key = os.environ.get("FRED_API_KEY")
    if not api_key:
        raise EnvironmentError("FRED_API_KEY not set in environment")
    return Fred(api_key=api_key)


def get_price_data(tickers: list, period: str = "1y") -> dict:
    """
    Batch-download OHLCV data for all tickers via yfinance.
    Returns dict: { "IWDA.AS": DataFrame, ... }
    yfinance silently drops tickers it cannot find — missing ones are logged.
    """
    raw = yf.download(
        tickers=tickers,
        period=period,
        auto_adjust=True,
        group_by="ticker",
        progress=False,
        threads=True,
    )

    result = {}
    for ticker in tickers:
        try:
            # yfinance returns flat columns for single ticker, MultiIndex for multiple
            if isinstance(raw.columns, pd.MultiIndex):
                df = raw[ticker].copy()
            else:
                df = raw.copy()
            df = df.dropna(subset=["Close"])
            if df.empty:
                print(f"[data_fetcher] WARNING: No data for {ticker}")
                continue
            result[ticker] = df
        except KeyError:
            print(f"[data_fetcher] WARNING: {ticker} not found in yfinance response")

    return result


def get_vix() -> float:
    """Fetch latest VIX close from FRED series VIXCLS."""
    fred = _get_fred()
    series = fred.get_series("VIXCLS", observation_start="2024-01-01")
    series = series.dropna()
    if series.empty:
        raise ValueError("VIXCLS returned empty series from FRED")
    return float(series.iloc[-1])


def get_hy_spread() -> float:
    """
    Fetch ICE BofA US High Yield Index OAS spread.
    FRED series: BAMLH0A0HYM2. Value is in percentage points (e.g. 3.5 = 3.5%).
    """
    fred = _get_fred()
    series = fred.get_series("BAMLH0A0HYM2", observation_start="2024-01-01")
    series = series.dropna()
    if series.empty:
        raise ValueError("BAMLH0A0HYM2 returned empty series from FRED")
    return float(series.iloc[-1])


def get_yield_curve() -> float:
    """
    Fetch 10Y-2Y Treasury yield spread.
    FRED series: T10Y2Y. Negative = inverted curve.
    """
    fred = _get_fred()
    series = fred.get_series("T10Y2Y", observation_start="2024-01-01")
    series = series.dropna()
    if series.empty:
        raise ValueError("T10Y2Y returned empty series from FRED")
    return float(series.iloc[-1])


def get_fear_greed() -> int:
    """
    Fetch CNN Fear & Greed index current value (0-100).
    Uses the fear_greed package which calls CNN's data API.
    """
    result = fear_greed.get()
    return int(result.value)
