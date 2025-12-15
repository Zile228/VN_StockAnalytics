"""
Feature engineering + supervised dataset builder (no pandas).

Purpose:
- Produce a flat CSV suitable for training on Colab (you can load with pandas there).
- Deterministic, with explicit no-leakage controls (lag fundamentals/macro).

Inputs (gold-first):
- data/gold/vn30_history_clean.csv (or fallback raw)
- data/silver/VN30_Sentiment_Analyzed.csv (optional feature)
- data/gold/fundamentals_long.csv or data/timeseries/bank.xlsx (fundamentals)
- data/timeseries/macro.xlsx (macro)
- data/gold/usdvnd_daily.csv (FX)

Output:
- data/gold/model_dataset_h{horizon}.csv
- sidecar metadata: .meta.json
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import math
from bisect import bisect_right
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple

import numpy as np

from src.data_access.loaders import SentimentItem, load_macro_xlsx, load_sentiment_analyzed_csv, load_vn30_history_csv
from src.data_access.fundamentals import FundamentalRecord
from src.data_access.fx import iter_usdvnd_canonical_rows


@dataclass(frozen=True, slots=True)
class DatasetSpec:
    horizon_days: int = 7  # target horizon in trading days (per-symbol index shift)
    ret_lookback_5d: int = 5
    vol_window: int = 20
    atr_window: int = 14
    vol_ma_window: int = 20
    sentiment_lookback_days: int = 7  # calendar days
    fund_lag_quarters: int = 1
    macro_lag_quarters: int = 1


def _quarter_index(year: int, quarter: int) -> int:
    return year * 4 + (quarter - 1)


def _date_to_quarter(d: dt.date) -> Tuple[int, int]:
    q = (d.month - 1) // 3 + 1
    return d.year, q


def _parse_float(s: object) -> Optional[float]:
    if s is None:
        return None
    ss = str(s).strip()
    if ss == "":
        return None
    try:
        return float(ss)
    except Exception:
        return None


def _sentiment_daily_map(items: List[SentimentItem]) -> Dict[Tuple[str, dt.date], Tuple[float, float, int]]:
    """
    Aggregate sentiment per (symbol, date): weighted by relevance.
    Returns (weighted_score_sum, relevance_sum, count).
    """
    out: Dict[Tuple[str, dt.date], Tuple[float, float, int]] = {}
    for it in items:
        key = (it.symbol.upper(), it.published_at.date())
        ws = float(it.sentiment_score) * float(it.relevance)
        rel = float(it.relevance)
        if key not in out:
            out[key] = (ws, rel, 1)
        else:
            a, b, c = out[key]
            out[key] = (a + ws, b + rel, c + 1)
    return out


def _sentiment_window_feature(
    daily_map: Dict[Tuple[str, dt.date], Tuple[float, float, int]],
    *,
    symbol: str,
    end_date: dt.date,
    lookback_days: int,
) -> Tuple[Optional[float], Optional[float], int]:
    """
    Rolling window over calendar days [end_date - (lookback_days-1), end_date]
    Returns (avg_score, avg_relevance, n_items_total).
    avg_score is relevance-weighted mean of sentiment_score.
    """
    if lookback_days <= 0:
        return None, None, 0
    wsum = 0.0
    rsum = 0.0
    cnt = 0
    for k in range(lookback_days):
        d = end_date - dt.timedelta(days=k)
        v = daily_map.get((symbol, d))
        if not v:
            continue
        ws, rel, n = v
        wsum += ws
        rsum += rel
        cnt += n
    if rsum <= 0:
        return None, None, cnt
    # weighted mean sentiment_score
    return (wsum / rsum), (rsum / max(1, cnt)), cnt


def _load_fx_series(fx_gold_csv: Path) -> Tuple[List[dt.date], List[float]]:
    """
    Load canonical FX series from gold CSV: date, close.
    Returns sorted dates and closes aligned.
    """
    rows: Dict[dt.date, float] = {}
    for r in iter_usdvnd_canonical_rows(fx_gold_csv):
        try:
            d = dt.date.fromisoformat(str(r["date"]))
            c = float(r["close"])
        except Exception:
            continue
        rows[d] = c
    dates = sorted(rows.keys())
    closes = [rows[d] for d in dates]
    return dates, closes


def _fx_ret_k(
    fx_dates: List[dt.date],
    fx_close: List[float],
    *,
    asof: dt.date,
    k: int = 5,
) -> Optional[float]:
    """
    Compute FX return over k FX observations ending at asof (using nearest <= asof).
    """
    if not fx_dates or k <= 0:
        return None
    idx = bisect_right(fx_dates, asof) - 1
    if idx < k or idx >= len(fx_dates):
        return None
    c0 = fx_close[idx - k]
    c1 = fx_close[idx]
    if c0 <= 0:
        return None
    return float(c1 / c0 - 1.0)


def build_model_dataset_csv(
    *,
    out_csv: Path,
    spec: DatasetSpec,
    vn30_history_csv: Path,
    sentiment_csv: Optional[Path],
    fundamentals_records: Optional[List[FundamentalRecord]],
    macro_xlsx: Optional[Path],
    fx_gold_csv: Optional[Path],
) -> Dict[str, object]:
    """
    Build a supervised dataset for regression:
    y = future return over horizon_days (trading days ahead).
    """
    out_csv.parent.mkdir(parents=True, exist_ok=True)

    # Load core market data
    history = load_vn30_history_csv(vn30_history_csv)
    symbols = sorted(history.keys())

    # Load sentiment (optional)
    sent_items: List[SentimentItem] = []
    if sentiment_csv and sentiment_csv.exists():
        sent_items = load_sentiment_analyzed_csv(sentiment_csv)
    sent_daily = _sentiment_daily_map(sent_items) if sent_items else {}

    # Macro map (optional)
    macro_map: Dict[int, Dict[str, float]] = {}
    if macro_xlsx and macro_xlsx.exists():
        for mp in load_macro_xlsx(macro_xlsx):
            qi = _quarter_index(mp.year, mp.quarter)
            macro_map[qi] = {
                "inf_pct": float(mp.inf_pct) if mp.inf_pct is not None else float("nan"),
                "gdp_pct": float(mp.gdp_pct) if mp.gdp_pct is not None else float("nan"),
                "dc_pct": float(mp.dc_pct) if mp.dc_pct is not None else float("nan"),
            }

    # FX series (optional)
    fx_dates: List[dt.date] = []
    fx_close: List[float] = []
    if fx_gold_csv and fx_gold_csv.exists():
        fx_dates, fx_close = _load_fx_series(fx_gold_csv)

    # Fundamentals records (optional). We will build per-symbol quarter maps to avoid O(N) scans per row.
    fund_records = fundamentals_records or []
    fund_by_sym_q: Dict[Tuple[str, int], Dict[str, float]] = {}
    best_qi_per_sym: Dict[str, int] = {}
    if fund_records:
        for r in fund_records:
            qi = _quarter_index(r.year, r.quarter)
            key = (r.symbol.upper(), qi)
            if key not in fund_by_sym_q:
                fund_by_sym_q[key] = {}
            fund_by_sym_q[key][r.metric] = float(r.value)
            prev = best_qi_per_sym.get(r.symbol.upper())
            if prev is None or qi > prev:
                best_qi_per_sym[r.symbol.upper()] = qi

    # Write dataset
    header = [
        "date",
        "symbol",
        "y_future_return",
        "close",
        "ret_1d",
        "ret_5d",
        "vol_20d",
        "atr_14",
        "avg_vol_20d",
        "vol_z_20d",
        "sent_7d",
        "sent_rel_7d",
        "sent_n_7d",
        "fund_year",
        "fund_quarter",
        "fund_roe",
        "fund_roa",
        "fund_p_e",
        "fund_p_b",
        "macro_inf",
        "macro_gdp",
        "macro_dc",
        "fx_ret_5d",
    ]

    rows_out = 0
    by_symbol_rows: Dict[str, int] = {}
    min_date: Optional[str] = None
    max_date: Optional[str] = None

    with out_csv.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()

        for sym in symbols:
            bars = history[sym]
            n = len(bars)
            if n <= max(spec.vol_window + 5, spec.atr_window + 5, spec.horizon_days + 5):
                continue

            dates = [b.date for b in bars]
            close = np.asarray([b.close for b in bars], dtype=float)
            high = np.asarray([b.high for b in bars], dtype=float)
            low = np.asarray([b.low for b in bars], dtype=float)
            vol = np.asarray([b.volume for b in bars], dtype=float)

            # daily returns (aligned to t): ret[t] = close[t]/close[t-1]-1, ret[0]=nan
            ret1 = np.full(n, np.nan, dtype=float)
            prev = close[:-1]
            ratio = np.divide(close[1:], prev, out=np.full_like(close[1:], np.nan), where=prev != 0)
            ret1[1:] = ratio - 1.0

            # ret_5d
            ret5 = np.full(n, np.nan, dtype=float)
            for t in range(spec.ret_lookback_5d, n):
                c0 = close[t - spec.ret_lookback_5d]
                if c0 > 0:
                    ret5[t] = close[t] / c0 - 1.0

            # realized vol 20d: std of last 20 daily returns ending at t
            vol20 = np.full(n, np.nan, dtype=float)
            for t in range(spec.vol_window, n):
                window = ret1[(t - spec.vol_window + 1) : (t + 1)]
                window = window[np.isfinite(window)]
                if window.size >= 2:
                    vol20[t] = float(np.std(window, ddof=1))

            # ATR14: true range rolling mean
            tr = np.full(n, np.nan, dtype=float)
            for t in range(1, n):
                tr[t] = max(
                    high[t] - low[t],
                    abs(high[t] - close[t - 1]),
                    abs(low[t] - close[t - 1]),
                )
            atr14 = np.full(n, np.nan, dtype=float)
            for t in range(spec.atr_window, n):
                window = tr[(t - spec.atr_window + 1) : (t + 1)]
                window = window[np.isfinite(window)]
                if window.size > 0:
                    atr14[t] = float(np.mean(window))

            # avg volume 20d and zscore
            vol_ma = np.full(n, np.nan, dtype=float)
            vol_z = np.full(n, np.nan, dtype=float)
            for t in range(spec.vol_ma_window, n):
                window = vol[(t - spec.vol_ma_window + 1) : (t + 1)]
                mu = float(np.mean(window))
                sd = float(np.std(window, ddof=1)) if window.size >= 2 else 0.0
                vol_ma[t] = mu
                if sd > 0:
                    vol_z[t] = float((vol[t] - mu) / sd)

            # dataset rows: start at max windows, end before horizon
            start_t = max(spec.vol_window, spec.atr_window, spec.vol_ma_window, spec.ret_lookback_5d, 1)
            end_t = n - spec.horizon_days - 1
            for t in range(start_t, end_t + 1):
                # target
                c0 = close[t]
                c1 = close[t + spec.horizon_days]
                if not (np.isfinite(c0) and np.isfinite(c1)) or c0 <= 0:
                    continue
                y = float(c1 / c0 - 1.0)

                d = dates[t]

                # sentiment window
                sent_val, sent_rel, sent_n = (None, None, 0)
                if sent_daily:
                    sent_val, sent_rel, sent_n = _sentiment_window_feature(
                        sent_daily,
                        symbol=sym,
                        end_date=d,
                        lookback_days=spec.sentiment_lookback_days,
                    )

                # fundamentals snapshot for this date (lag-aware)
                fund_year = ""
                fund_quarter = ""
                fund_roe = ""
                fund_roa = ""
                fund_pe = ""
                fund_pb = ""
                if fund_by_sym_q:
                    fy, fq = _date_to_quarter(d)
                    qi = _quarter_index(fy, fq) - int(spec.fund_lag_quarters)
                    m = fund_by_sym_q.get((sym, qi))
                    if m:
                        fund_year = qi // 4
                        fund_quarter = (qi % 4) + 1
                        fund_roe = m.get("roe", "")
                        fund_roa = m.get("roa", "")
                        fund_pe = m.get("p_e", "")
                        fund_pb = m.get("p_b", "")

                # macro quarter (lag-aware)
                macro_inf = ""
                macro_gdp = ""
                macro_dc = ""
                if macro_map:
                    my, mq = _date_to_quarter(d)
                    qi = _quarter_index(my, mq) - spec.macro_lag_quarters
                    mm = macro_map.get(qi)
                    if mm:
                        macro_inf = mm.get("inf_pct", "")
                        macro_gdp = mm.get("gdp_pct", "")
                        macro_dc = mm.get("dc_pct", "")

                fx_ret5 = _fx_ret_k(fx_dates, fx_close, asof=d, k=5) if fx_dates else None

                row = {
                    "date": d.isoformat(),
                    "symbol": sym,
                    "y_future_return": y,
                    "close": float(close[t]),
                    "ret_1d": float(ret1[t]) if np.isfinite(ret1[t]) else "",
                    "ret_5d": float(ret5[t]) if np.isfinite(ret5[t]) else "",
                    "vol_20d": float(vol20[t]) if np.isfinite(vol20[t]) else "",
                    "atr_14": float(atr14[t]) if np.isfinite(atr14[t]) else "",
                    "avg_vol_20d": float(vol_ma[t]) if np.isfinite(vol_ma[t]) else "",
                    "vol_z_20d": float(vol_z[t]) if np.isfinite(vol_z[t]) else "",
                    "sent_7d": float(sent_val) if sent_val is not None else "",
                    "sent_rel_7d": float(sent_rel) if sent_rel is not None else "",
                    "sent_n_7d": int(sent_n),
                    "fund_year": fund_year,
                    "fund_quarter": fund_quarter,
                    "fund_roe": fund_roe,
                    "fund_roa": fund_roa,
                    "fund_p_e": fund_pe,
                    "fund_p_b": fund_pb,
                    "macro_inf": macro_inf if macro_inf != float("nan") else "",
                    "macro_gdp": macro_gdp if macro_gdp != float("nan") else "",
                    "macro_dc": macro_dc if macro_dc != float("nan") else "",
                    "fx_ret_5d": float(fx_ret5) if fx_ret5 is not None else "",
                }
                w.writerow(row)
                rows_out += 1
                by_symbol_rows[sym] = by_symbol_rows.get(sym, 0) + 1
                min_date = row["date"] if min_date is None or row["date"] < min_date else min_date
                max_date = row["date"] if max_date is None or row["date"] > max_date else max_date

    meta = {
        "output_csv": str(out_csv),
        "generated_at": dt.datetime.now().isoformat(),
        "spec": asdict(spec),
        "rows_out": rows_out,
        "symbols": len(by_symbol_rows),
        "date_range": {"min": min_date, "max": max_date},
        "rows_by_symbol_top10": sorted(by_symbol_rows.items(), key=lambda kv: kv[1], reverse=True)[:10],
        "columns": header,
        "notes": "y_future_return uses trading-day shift per symbol; fundamentals/macro lag are applied by quarter index.",
    }

    meta_path = out_csv.with_suffix(out_csv.suffix + ".meta.json")
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    return meta


