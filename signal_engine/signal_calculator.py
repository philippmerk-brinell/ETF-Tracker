"""
signal_calculator.py

Pure functions: raw value → normalized score (0-100) + level label.
No I/O. All inputs are floats or pandas Series.
"""
import numpy as np
import pandas as pd
from ta.momentum import RSIIndicator


def _piecewise_linear(value: float, breakpoints: list) -> float:
    """
    Map a value to a score using piecewise linear interpolation.

    breakpoints: list of (input_value, output_score) tuples, sorted ascending by input_value.
    numpy.interp clamps automatically at boundaries.

    Example: VIX breakpoints [(20,0),(25,30),(30,60),(40,100)]
    VIX=27.5 → interpolates between (25,30) and (30,60) → score=45
    """
    xs = [bp[0] for bp in breakpoints]
    ys = [bp[1] for bp in breakpoints]
    return float(np.interp(value, xs, ys))


def _level_from_score(score: float) -> str:
    if score >= 80:
        return "strong_buy"
    elif score >= 60:
        return "buy"
    elif score >= 30:
        return "watch"
    else:
        return "neutral"


def score_drawdown(current: float, ath: float) -> dict:
    """
    Drawdown from ATH signal.
    drawdown_pct = (ath - current) / ath * 100  [positive = below ATH]
    Breakpoints: 0%→0, 10%→30, 15%→60, 25%→100
    """
    if ath <= 0 or current <= 0:
        return {"value": 0.0, "score": 0.0, "level": "neutral"}

    drawdown_pct = max(0.0, (ath - current) / ath * 100)
    breakpoints = [(0, 0), (10, 30), (15, 60), (25, 100)]
    score = _piecewise_linear(drawdown_pct, breakpoints)

    return {
        "value": round(drawdown_pct, 2),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def score_vix(vix: float) -> dict:
    """
    VIX fear gauge. Breakpoints: (20,0), (25,30), (30,60), (40,100)
    """
    breakpoints = [(20, 0), (25, 30), (30, 60), (40, 100)]
    score = _piecewise_linear(vix, breakpoints)

    return {
        "value": round(vix, 2),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def score_hy_spread(spread: float) -> dict:
    """
    High-yield credit spread (in %).
    Breakpoints: (3.5,0), (4.5,30), (5.5,60), (8.0,100)
    """
    breakpoints = [(3.5, 0), (4.5, 30), (5.5, 60), (8.0, 100)]
    score = _piecewise_linear(spread, breakpoints)

    return {
        "value": round(spread, 2),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def score_rsi(rsi_value: float) -> dict:
    """
    RSI oversold signal (inverted: lower RSI = higher score).
    Negate input so numpy.interp can use ascending x-axis.
    Breakpoints on negated RSI: (-50,0), (-40,10), (-35,30), (-30,60), (-25,100)
    """
    breakpoints = [(-50, 0), (-40, 10), (-35, 30), (-30, 60), (-25, 100)]
    score = max(0.0, min(100.0, _piecewise_linear(-rsi_value, breakpoints)))

    return {
        "value": round(rsi_value, 1),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def score_fear_greed(fg: int) -> dict:
    """
    CNN Fear & Greed (inverted: lower = more fear = higher score).
    Breakpoints on negated input: (-50,0), (-25,30), (-15,60), (-10,100)
    """
    breakpoints = [(-50, 0), (-25, 30), (-15, 60), (-10, 100)]
    score = max(0.0, min(100.0, _piecewise_linear(-fg, breakpoints)))

    return {
        "value": int(fg),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def score_sma200(price: float, sma200: float) -> dict:
    """
    Price vs 200-day SMA.
    pct_below = (sma200 - price) / sma200 * 100  [positive = below SMA]
    Breakpoints: (-5,0), (0,10), (5,30), (10,60), (15,100)
    Being above SMA → score 0; being 15%+ below → score 100.
    """
    if sma200 <= 0:
        return {"value": 0.0, "score": 0.0, "level": "neutral"}

    pct_below = (sma200 - price) / sma200 * 100
    breakpoints = [(-5, 0), (0, 10), (5, 30), (10, 60), (15, 100)]
    score = max(0.0, min(100.0, _piecewise_linear(pct_below, breakpoints)))

    return {
        "value": round(pct_below, 2),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def score_yield_curve(spread: float) -> dict:
    """
    10Y-2Y yield curve spread (context signal, capped at 70).
    Breakpoints: (0.5,0), (0.2,20), (0.0,50), (-0.5,70)
    """
    breakpoints = [(0.5, 0), (0.2, 20), (0.0, 50), (-0.5, 70)]
    score = max(0.0, min(70.0, _piecewise_linear(spread, breakpoints)))

    return {
        "value": round(spread, 3),
        "score": round(score, 1),
        "level": _level_from_score(score),
    }


def compute_rsi_from_series(close_series: pd.Series, window: int = 14) -> float:
    """Compute RSI from a Close price Series using the ta library."""
    if len(close_series) < window + 1:
        raise ValueError(f"Need at least {window + 1} data points for RSI-{window}, got {len(close_series)}")
    rsi_indicator = RSIIndicator(close=close_series, window=window)
    return float(rsi_indicator.rsi().dropna().iloc[-1])


def compute_sma(close_series: pd.Series, window: int = 200) -> float:
    """Compute the most recent N-day SMA from a Close price Series."""
    if len(close_series) < window:
        print(f"[signal_calculator] WARNING: Only {len(close_series)} days for SMA{window}, using all")
        window = len(close_series)
    return float(close_series.tail(window).mean())
