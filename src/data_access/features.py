"""
Feature engineering utilities (no pandas).

Computes:
- returns (N-day)
- realized volatility (rolling std of daily returns)
- ATR (Average True Range)
- liquidity proxy (avg volume)
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np

from .loaders import OHLCVBar


@dataclass(frozen=True, slots=True)
class SymbolFeatures:
    symbol: str
    last_close: float
    return_5d: float
    realized_vol_20d: float
    atr_14: float
    avg_volume_20d: float


def _safe_last(arr: np.ndarray) -> float:
    return float(arr[-1]) if arr.size > 0 else float("nan")


def compute_symbol_features(
    history_by_symbol: Dict[str, List[OHLCVBar]],
    *,
    ret_window: int = 5,
    vol_window: int = 20,
    atr_window: int = 14,
    vol_liquidity_window: int = 20,
) -> Dict[str, SymbolFeatures]:
    """
    Compute per-symbol features from OHLCV bars.
    Bars must be sorted by date ascending (loader ensures this).
    """
    out: Dict[str, SymbolFeatures] = {}
    for sym, bars in history_by_symbol.items():
        if len(bars) < max(ret_window + 1, vol_window + 1, atr_window + 1, vol_liquidity_window):
            continue

        close = np.array([b.close for b in bars], dtype=float)
        high = np.array([b.high for b in bars], dtype=float)
        low = np.array([b.low for b in bars], dtype=float)
        volume = np.array([b.volume for b in bars], dtype=float)

        # Daily simple returns (safe division to avoid warnings when close==0)
        prev = close[:-1]
        ratio = np.divide(
            close[1:],
            prev,
            out=np.zeros_like(close[1:], dtype=float),
            where=prev != 0,
        )
        ret = ratio - 1.0

        # Momentum proxy
        c0 = close[-(ret_window + 1)]
        c1 = close[-1]
        ret_5d = float(c1 / c0 - 1.0) if c0 > 0 else 0.0

        # Realized vol: std of daily returns over window
        vol_slice = ret[-vol_window:]
        realized_vol = float(np.std(vol_slice, ddof=1)) if vol_slice.size >= 2 else float("nan")

        # ATR: average true range over window
        prev_close = close[:-1]
        tr = np.maximum(
            high[1:] - low[1:],
            np.maximum(np.abs(high[1:] - prev_close), np.abs(low[1:] - prev_close)),
        )
        atr_slice = tr[-atr_window:]
        atr = float(np.mean(atr_slice)) if atr_slice.size > 0 else float("nan")

        # Liquidity proxy: average volume
        avg_vol = float(np.mean(volume[-vol_liquidity_window:]))

        out[sym] = SymbolFeatures(
            symbol=sym,
            last_close=float(close[-1]),
            return_5d=ret_5d,
            realized_vol_20d=realized_vol,
            atr_14=atr,
            avg_volume_20d=avg_vol,
        )
    return out


def uncertainty_band_from_vol(
    expected_return: float,
    realized_vol: float,
    horizon_days: int,
) -> Tuple[float, float, float]:
    """
    A simple parametric band assuming normal-ish uncertainty scaling with sqrt(time).
    """
    if not math.isfinite(realized_vol) or realized_vol <= 0 or horizon_days <= 0:
        return (expected_return, expected_return, expected_return)
    scale = realized_vol * math.sqrt(float(horizon_days))
    # Rough P10/P50/P90 around expected return
    p50 = expected_return
    p10 = expected_return - 1.2816 * scale
    p90 = expected_return + 1.2816 * scale
    return (float(p10), float(p50), float(p90))


def spread_proxy_from_liquidity_and_vol(
    avg_volume_20d: float,
    realized_vol_20d: float,
) -> float:
    """
    Proxy for spread/slippage when no orderbook:
    higher vol, lower liquidity -> higher proxy.
    """
    vol = float(realized_vol_20d) if math.isfinite(realized_vol_20d) else 0.0
    liq = float(avg_volume_20d) if math.isfinite(avg_volume_20d) else 0.0
    if liq <= 0:
        return float("inf")
    return vol / math.sqrt(liq)


