"""
OHLCV validation/cleaning utilities (no pandas).

Input:
- data/timeseries/vn30_history.csv

Goal:
- Produce a "gold" cleaned OHLCV file for downstream feature engineering/backtest.

Cleaning policy (minimal, deterministic):
- Drop rows with missing critical fields or bad date.
- Drop rows with close <= 0 (non-sensical for equities).
- If high < max(open, close): set high = max(high, open, close)  (minimal correction)
- If low > min(open, close): set low = min(low, open, close)     (minimal correction)
- If high < low after correction: drop row.

Also outputs a small stats dict for auditing.
"""

from __future__ import annotations

import csv
import datetime as dt
from collections import Counter, defaultdict
from pathlib import Path
from typing import Dict, Iterator, Optional, Tuple


def _parse_date_ymd(s: str) -> Optional[dt.date]:
    raw = (s or "").strip()
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(raw[:10])
    except Exception:
        return None


def _parse_float(s: str) -> Optional[float]:
    raw = (s or "").strip()
    if raw == "":
        return None
    try:
        return float(raw.replace(",", ""))
    except Exception:
        return None


def clean_vn30_history_csv(in_path: Path, out_path: Path) -> Dict[str, int]:
    """
    Returns stats:
      - rows_in
      - rows_out
      - dropped_*
      - fixed_high
      - fixed_low
    """
    stats = Counter()
    out_path.parent.mkdir(parents=True, exist_ok=True)

    with in_path.open("r", encoding="utf-8-sig", newline="") as fin, out_path.open(
        "w", encoding="utf-8", newline=""
    ) as fout:
        r = csv.DictReader(fin)
        required = {"time", "open", "high", "low", "close", "volume", "symbol"}
        if not r.fieldnames or not required.issubset(set(r.fieldnames)):
            raise ValueError(f"Missing required columns: {required}")

        w = csv.DictWriter(
            fout, fieldnames=["time", "open", "high", "low", "close", "volume", "symbol"]
        )
        w.writeheader()

        for row in r:
            stats["rows_in"] += 1
            sym = (row.get("symbol") or "").strip().upper()
            d = _parse_date_ymd(row.get("time", "") or "")
            o = _parse_float(row.get("open", "") or "")
            h = _parse_float(row.get("high", "") or "")
            l = _parse_float(row.get("low", "") or "")
            c = _parse_float(row.get("close", "") or "")
            v = _parse_float(row.get("volume", "") or "")

            if not sym or d is None:
                stats["dropped_bad_symbol_or_date"] += 1
                continue
            if any(x is None for x in (o, h, l, c, v)):
                stats["dropped_missing_numeric"] += 1
                continue
            if c <= 0:
                stats["dropped_non_positive_close"] += 1
                continue
            if v < 0:
                stats["dropped_negative_volume"] += 1
                continue

            # minimal corrections
            max_oc = max(o, c)
            min_oc = min(o, c)
            if h < max_oc:
                h = max(h, max_oc)
                stats["fixed_high"] += 1
            if l > min_oc:
                l = min(l, min_oc)
                stats["fixed_low"] += 1
            if h < l:
                stats["dropped_high_lt_low"] += 1
                continue

            w.writerow(
                {
                    "time": d.isoformat(),
                    "open": f"{o:.10g}",
                    "high": f"{h:.10g}",
                    "low": f"{l:.10g}",
                    "close": f"{c:.10g}",
                    "volume": f"{v:.10g}",
                    "symbol": sym,
                }
            )
            stats["rows_out"] += 1

    return dict(stats)


