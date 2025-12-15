"""
Helpers to extract a compact fundamentals snapshot from long-form fundamentals records.

Used for evidence/explainability (not for core numeric decisions yet).
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple

from .fundamentals import FundamentalRecord


@dataclass(frozen=True, slots=True)
class FundamentalsSnapshot:
    symbol: str
    year: int
    quarter: int
    metrics: Dict[str, float]


def _quarter_index(year: int, quarter: int) -> int:
    return year * 4 + (quarter - 1)


def _asof_to_quarter(asof_date: dt.date) -> Tuple[int, int]:
    q = (asof_date.month - 1) // 3 + 1
    return (asof_date.year, q)


def latest_fundamentals_snapshot(
    records: Iterable[FundamentalRecord],
    *,
    asof_date: dt.date,
    lag_quarters: int = 0,
    preferred_metrics: Optional[List[str]] = None,
) -> Dict[str, FundamentalsSnapshot]:
    """
    Pick latest quarter <= asof quarter minus lag_quarters, per symbol.

    preferred_metrics are metric names in normalized form (see fundamentals._norm_metric),
    e.g. ['roe', 'p_e', 'p_b'] depending on normalization.
    If omitted, includes all metrics encountered for that chosen quarter.
    """
    y, q = _asof_to_quarter(asof_date)
    cutoff = _quarter_index(y, q) - int(lag_quarters)

    # best quarter per symbol
    best_qi: Dict[str, int] = {}
    by_sym_q: Dict[tuple, Dict[str, float]] = {}

    for r in records:
        qi = _quarter_index(r.year, r.quarter)
        if qi > cutoff:
            continue
        key = (r.symbol, r.year, r.quarter)
        if key not in by_sym_q:
            by_sym_q[key] = {}
        by_sym_q[key][r.metric] = float(r.value)

        prev = best_qi.get(r.symbol)
        if prev is None or qi > prev:
            best_qi[r.symbol] = qi

    out: Dict[str, FundamentalsSnapshot] = {}
    for sym, qi in best_qi.items():
        # find the matching year/quarter for qi
        year = qi // 4
        quarter = (qi % 4) + 1
        m = by_sym_q.get((sym, year, quarter), {})
        if preferred_metrics:
            m = {k: v for k, v in m.items() if k in set(preferred_metrics)}
        out[sym] = FundamentalsSnapshot(symbol=sym, year=year, quarter=quarter, metrics=m)
    return out


def fundamentals_boost(snapshot: Optional[FundamentalsSnapshot]) -> float:
    """
    Deterministic small boost for expected_return stub.

    Bounded to [-0.01, +0.01] and designed to be weak vs price momentum.
    Uses a simple heuristic:
    - Higher ROE/ROA -> positive
    - Lower P/E, P/B -> positive (valuation cheaper)
    Missing metrics contribute 0.
    """
    if snapshot is None:
        return 0.0
    m = snapshot.metrics or {}
    roe = float(m.get("roe", 0.0) or 0.0)
    roa = float(m.get("roa", 0.0) or 0.0)
    pe = float(m.get("p_e", 0.0) or 0.0)
    pb = float(m.get("p_b", 0.0) or 0.0)

    # Normalize around typical ranges (very rough).
    # roe ~ 0.10..0.25, roa ~ 0.01..0.03, pe ~ 6..18, pb ~ 0.8..3
    score = 0.0
    score += (roe - 0.15) / 0.10  # -1..+1 around 15%
    score += (roa - 0.02) / 0.01  # -1..+1 around 2%
    if pe > 0:
        score += (10.0 - pe) / 10.0
    if pb > 0:
        score += (1.5 - pb) / 1.5

    # scale down heavily
    boost = 0.0025 * score
    if boost > 0.01:
        return 0.01
    if boost < -0.01:
        return -0.01
    return float(boost)


