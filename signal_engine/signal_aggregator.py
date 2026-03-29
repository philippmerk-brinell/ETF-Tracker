"""
signal_aggregator.py

Combines per-ETF and market-wide signals into a weighted composite score.
"""

DEFAULT_WEIGHTS = {
    "drawdown":    0.25,
    "vix":         0.20,
    "hy_spread":   0.15,
    "rsi":         0.15,
    "fear_greed":  0.10,
    "sma200":      0.10,
    "yield_curve": 0.05,
}


def composite_to_alert_level(score: float, thresholds: dict) -> str:
    """
    Map composite score to alert level string.
    thresholds keys: elevated, strong, extreme.
    Returns: "no_action" | "monitor" | "elevated" | "strong" | "extreme"
    """
    if score >= thresholds.get("extreme", 80):
        return "extreme"
    elif score >= thresholds.get("strong", 65):
        return "strong"
    elif score >= thresholds.get("elevated", 50):
        return "elevated"
    elif score >= 30:
        return "monitor"
    else:
        return "no_action"


def compute_composite(signals: dict, weights: dict = None) -> dict:
    """
    Compute weighted composite score from a dict of signal result dicts.

    Each signal dict must have a 'score' key (0-100).
    Missing signals (fetch failures) have their weight redistributed
    proportionally among available signals — prevents silent false negatives.

    Returns: {composite_score, signals, weights_used}
    Note: alert_level is NOT set here — caller passes thresholds to
    composite_to_alert_level() after this call.
    """
    if weights is None:
        weights = DEFAULT_WEIGHTS

    missing = [k for k in weights if k not in signals]
    if missing:
        print(f"[aggregator] Missing signals (redistributing weight): {missing}")
        available_weight = sum(v for k, v in weights.items() if k not in missing)
        if available_weight == 0:
            return {"composite_score": 0.0, "signals": signals, "weights_used": weights}
        weights = {k: v / available_weight for k, v in weights.items() if k not in missing}

    composite = sum(
        signals[name]["score"] * weight
        for name, weight in weights.items()
        if name in signals
    )

    return {
        "composite_score": round(composite, 1),
        "signals": signals,
        "weights_used": weights,
    }
