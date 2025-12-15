"""
FX ingestion utilities (no pandas).

Input:
- data/timeseries/Dữ-liệu-Lịch-sử-USD_VND-1.csv
  Header (observed): 'Ngày','Lần cuối','Mở','Cao','Thấp','KL','% Thay đổi'

Output (canonical):
- date (YYYY-MM-DD)
- close (float)
- pct_change (decimal float, optional)
"""

from __future__ import annotations

import csv
import datetime as dt
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, Iterator, List, Optional, Tuple


def _parse_date_dmy(s: str) -> Optional[dt.date]:
    raw = (s or "").strip()
    if not raw:
        return None
    try:
        return dt.datetime.strptime(raw, "%d/%m/%Y").date()
    except Exception:
        return None


def _parse_float_vn(s: str) -> Optional[float]:
    raw = (s or "").strip()
    if raw == "":
        return None
    raw = raw.replace(",", "")
    try:
        return float(raw)
    except Exception:
        return None


def _parse_percent_vn(s: str) -> Optional[float]:
    raw = (s or "").strip()
    if raw == "":
        return None
    raw = raw.replace("%", "").replace(",", ".")
    try:
        return float(raw) / 100.0
    except Exception:
        return None


def iter_usdvnd_canonical_rows(in_path: Path) -> Iterator[dict]:
    """
    Yields canonical rows dict: {date, close, pct_change}.
    """
    with in_path.open("r", encoding="utf-8-sig", newline="") as f:
        r = csv.DictReader(f)
        # If this is already canonical gold CSV: date,close,pct_change
        if r.fieldnames and set(r.fieldnames) >= {"date", "close"}:
            for row in r:
                d = (row.get("date") or "").strip()
                close = _parse_float_vn(row.get("close") or "")
                pct = row.get("pct_change")
                if not d or close is None:
                    continue
                # pct_change might already be decimal string
                pct_v: object = ""
                if pct is not None and str(pct).strip() != "":
                    try:
                        pct_v = float(str(pct).strip())
                    except Exception:
                        pct_v = ""
                yield {"date": d, "close": float(close), "pct_change": pct_v}
            return

        # Otherwise assume raw Vietnamese header
        for row in r:
            d = _parse_date_dmy(row.get("Ngày", "") or "")
            close = _parse_float_vn(row.get("Lần cuối", "") or "")
            pct = _parse_percent_vn(row.get("% Thay đổi", "") or "")
            if d is None or close is None:
                continue
            yield {"date": d.isoformat(), "close": float(close), "pct_change": float(pct) if pct is not None else ""}


def write_usdvnd_canonical_csv(in_path: Path, out_path: Path) -> Dict[str, int]:
    """
    Writes canonical CSV sorted by date ascending and deduped by date (keep last seen).
    """
    rows_by_date: Dict[str, dict] = {}
    for r in iter_usdvnd_canonical_rows(in_path):
        rows_by_date[r["date"]] = r

    dates = sorted(rows_by_date.keys())
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=["date", "close", "pct_change"])
        w.writeheader()
        for d in dates:
            w.writerow(rows_by_date[d])

    return {"rows": len(dates)}


