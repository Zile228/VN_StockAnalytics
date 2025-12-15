"""
Deterministic "forecast bundle" loader from locally saved artifacts.

Current supported source:
- models/artifacts_h7/val_predictions.csv
  columns: date,symbol,y_true,y_pred

This is NOT live inference; it is a pragmatic bridge to integrate
pretrained results into the orchestrator without a model server.

It provides:
- expected_return: y_pred (already horizon-specific, e.g. h7)
- uncertainty_sigma: rolling RMSE of (y_true - y_pred) per symbol
- model_quality: deterministic mapping from RMSE to [0,1]
"""

from __future__ import annotations

import csv
import datetime as dt
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple


@dataclass(frozen=True, slots=True)
class ForecastPoint:
    symbol: str
    asof_date: dt.date
    horizon_days: int
    expected_return: float
    uncertainty_sigma: float
    model_quality: float
    source: str


def _parse_date(s: str) -> Optional[dt.date]:
    raw = (s or "").strip()
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(raw[:10])
    except Exception:
        return None


def _clamp(x: float, lo: float, hi: float) -> float:
    return float(max(lo, min(hi, x)))


def _quality_from_rmse(rmse: float) -> float:
    """
    Map RMSE on returns to a [0,1] quality score.
    Heuristic: rmse ~ 0.02 -> ~0.75, rmse ~ 0.05 -> ~0.4
    """
    if not math.isfinite(rmse) or rmse < 0:
        return 0.0
    q = 1.0 / (1.0 + (rmse / 0.02) ** 2)
    return _clamp(q, 0.0, 1.0)


def load_val_predictions_forecast(
    path: Path,
    *,
    asof_date: dt.date,
    horizon_days: int,
    rmse_window: int = 60,
) -> Dict[str, ForecastPoint]:
    """
    For each symbol:
    - choose the last row with date <= asof_date
    - compute rolling RMSE over last rmse_window errors up to that date
    """
    # store chronological rows per symbol
    rows_by_sym: Dict[str, List[Tuple[dt.date, float, float]]] = {}
    with path.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            sym = (row.get("symbol") or "").strip().upper()
            d = _parse_date(row.get("date") or "")
            if not sym or d is None:
                continue
            try:
                y_true = float(row.get("y_true") or "nan")
                y_pred = float(row.get("y_pred") or "nan")
            except Exception:
                continue
            if not (math.isfinite(y_pred) and math.isfinite(y_true)):
                continue
            rows_by_sym.setdefault(sym, []).append((d, y_true, y_pred))

    out: Dict[str, ForecastPoint] = {}
    for sym, rows in rows_by_sym.items():
        rows.sort(key=lambda x: x[0])
        # find last <= asof_date
        idx = None
        for i in range(len(rows) - 1, -1, -1):
            if rows[i][0] <= asof_date:
                idx = i
                break
        if idx is None:
            continue
        d, y_true, y_pred = rows[idx]

        start = max(0, idx - rmse_window + 1)
        errs = [(rows[i][1] - rows[i][2]) for i in range(start, idx + 1)]
        if len(errs) >= 2:
            mse = sum(e * e for e in errs) / float(len(errs))
            rmse = math.sqrt(mse)
        else:
            rmse = float("nan")

        sigma = float(rmse) if math.isfinite(rmse) else 0.03  # fallback sigma
        quality = _quality_from_rmse(sigma)
        out[sym] = ForecastPoint(
            symbol=sym,
            asof_date=d,
            horizon_days=int(horizon_days),
            expected_return=float(y_pred),
            uncertainty_sigma=float(sigma),
            model_quality=float(quality),
            source=f"val_predictions_csv(rmse_window={rmse_window})",
        )
    return out


