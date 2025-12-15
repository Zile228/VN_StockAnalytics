from __future__ import annotations

import csv
import datetime as dt
import json
import math
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Sequence, Tuple

import numpy as np


def _parse_date(s: str) -> Optional[dt.date]:
    raw = (s or "").strip()
    if not raw:
        return None
    try:
        return dt.date.fromisoformat(raw[:10])
    except Exception:
        return None


def _safe_float(x: str) -> Optional[float]:
    raw = (x or "").strip()
    if raw == "" or raw.lower() == "nan":
        return None
    try:
        v = float(raw)
    except Exception:
        return None
    if not math.isfinite(v):
        return None
    return float(v)


def _corr_from_summaries(n: int, m2x: float, m2y: float, cxy: float) -> float:
    if n < 2:
        return 0.0
    denom = math.sqrt(max(1e-18, m2x) * max(1e-18, m2y))
    if denom <= 0:
        return 0.0
    return float(cxy / denom)


@dataclass
class OnlineCorr:
    """
    Online stats to compute Pearson correlation.
    Uses a Welford-style update for covariance + variances.
    """

    n: int = 0
    mean_x: float = 0.0
    mean_y: float = 0.0
    m2x: float = 0.0
    m2y: float = 0.0
    cxy: float = 0.0

    def update(self, x: float, y: float) -> None:
        self.n += 1
        dx = x - self.mean_x
        self.mean_x += dx / self.n
        dy = y - self.mean_y
        self.mean_y += dy / self.n
        self.m2x += dx * (x - self.mean_x)
        self.m2y += dy * (y - self.mean_y)
        self.cxy += dx * (y - self.mean_y)

    def corr(self) -> float:
        return _corr_from_summaries(self.n, self.m2x, self.m2y, self.cxy)


def load_dataset_meta(meta_path: Path) -> dict:
    return json.loads(meta_path.read_text(encoding="utf-8"))


def iter_dataset_rows(dataset_csv: Path) -> Iterable[dict]:
    with dataset_csv.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            yield row


def compute_feature_correlations(
    dataset_csv: Path,
    *,
    features: Sequence[str],
    target_col: str = "y_future_return",
    max_rows: Optional[int] = None,
) -> Dict[str, float]:
    stats: Dict[str, OnlineCorr] = {f: OnlineCorr() for f in features}
    seen = 0
    for row in iter_dataset_rows(dataset_csv):
        y = _safe_float(row.get(target_col, ""))
        if y is None:
            continue
        ok = False
        for f in features:
            x = _safe_float(row.get(f, ""))
            if x is None:
                continue
            stats[f].update(float(x), float(y))
            ok = True
        if ok:
            seen += 1
        if max_rows is not None and seen >= max_rows:
            break
    return {f: stats[f].corr() for f in features}


def group_for_feature(name: str) -> str:
    if name.startswith("sent_"):
        return "sentiment"
    if name.startswith("fund_"):
        return "fundamentals"
    if name.startswith("macro_"):
        return "macro"
    if name.startswith("fx_"):
        return "fx"
    if name.startswith("ret_") or name.startswith("vol_") or name.startswith("atr_") or name.startswith("avg_vol_"):
        return "technical"
    return "other"


def compute_sentiment_bins_effect(
    dataset_csv: Path,
    *,
    sent_col: str = "sent_7d",
    target_col: str = "y_future_return",
) -> List[dict]:
    """
    Deterministic conditional analysis:
    - bin sentiment into 5 buckets by fixed thresholds
    - compute avg future return and win rate per bin
    """
    bins = [
        ("<= -0.6", lambda s: s <= -0.6),
        ("(-0.6, -0.2]", lambda s: -0.6 < s <= -0.2),
        ("(-0.2, 0.2]", lambda s: -0.2 < s <= 0.2),
        ("(0.2, 0.6]", lambda s: 0.2 < s <= 0.6),
        ("> 0.6", lambda s: s > 0.6),
    ]
    sums = [0.0] * len(bins)
    wins = [0] * len(bins)
    counts = [0] * len(bins)
    missing = 0
    total = 0

    for row in iter_dataset_rows(dataset_csv):
        y = _safe_float(row.get(target_col, ""))
        if y is None:
            continue
        total += 1
        s = _safe_float(row.get(sent_col, ""))
        if s is None:
            missing += 1
            continue
        for i, (_label, pred) in enumerate(bins):
            if pred(float(s)):
                counts[i] += 1
                sums[i] += float(y)
                if float(y) > 0:
                    wins[i] += 1
                break

    out = []
    out.append(
        {
            "bin": "missing",
            "n": int(missing),
            "avg_future_return": 0.0,
            "win_rate": 0.0,
        }
    )
    for i, (label, _pred) in enumerate(bins):
        n = counts[i]
        out.append(
            {
                "bin": label,
                "n": int(n),
                "avg_future_return": float(sums[i] / n) if n else 0.0,
                "win_rate": float(wins[i] / n) if n else 0.0,
            }
        )
    out.append({"bin": "coverage", "n": int(total - missing), "avg_future_return": 0.0, "win_rate": float((total - missing) / total) if total else 0.0})
    return out


def load_vol_by_date_symbol(dataset_csv: Path, *, vol_col: str = "vol_20d") -> Dict[Tuple[str, dt.date], float]:
    out: Dict[Tuple[str, dt.date], float] = {}
    for row in iter_dataset_rows(dataset_csv):
        d = _parse_date(row.get("date", ""))
        sym = (row.get("symbol") or "").strip().upper()
        v = _safe_float(row.get(vol_col, ""))
        if d is None or not sym or v is None:
            continue
        out[(sym, d)] = float(v)
    return out


def _quality_from_rmse(rmse: float) -> float:
    if not math.isfinite(rmse) or rmse < 0:
        return 0.0
    q = 1.0 / (1.0 + (rmse / 0.02) ** 2)
    return float(max(0.0, min(1.0, q)))


def compute_error_vs_vol_relation(
    *,
    val_predictions_csv: Path,
    dataset_csv: Path,
    rmse_window: int = 60,
) -> dict:
    """
    Join model errors with realized volatility (vol_20d) from the dataset.
    Outputs correlations for:
    - vol_20d vs |error|
    - vol_20d vs rolling RMSE
    - vol_20d vs model_quality (derived from RMSE)
    Also includes directional accuracy.
    """
    vol_map = load_vol_by_date_symbol(dataset_csv, vol_col="vol_20d")

    abs_err_corr = OnlineCorr()
    rmse_corr = OnlineCorr()
    qual_corr = OnlineCorr()
    dir_ok = 0
    dir_n = 0

    # Per-symbol rolling window of squared errors
    sq_errs: Dict[str, List[float]] = {}

    with val_predictions_csv.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            d = _parse_date(row.get("date", ""))
            sym = (row.get("symbol") or "").strip().upper()
            y_true = _safe_float(row.get("y_true", ""))
            y_pred = _safe_float(row.get("y_pred", ""))
            if d is None or not sym or y_true is None or y_pred is None:
                continue
            vol = vol_map.get((sym, d))
            if vol is None:
                continue

            err = float(y_true) - float(y_pred)
            abs_err = abs(err)

            # directional accuracy
            dir_n += 1
            if (y_true >= 0 and y_pred >= 0) or (y_true < 0 and y_pred < 0):
                dir_ok += 1

            q = sq_errs.setdefault(sym, [])
            q.append(err * err)
            if len(q) > rmse_window:
                q.pop(0)
            rmse = math.sqrt(sum(q) / float(len(q))) if len(q) else float("nan")
            quality = _quality_from_rmse(float(rmse))

            abs_err_corr.update(float(vol), float(abs_err))
            if math.isfinite(rmse):
                rmse_corr.update(float(vol), float(rmse))
            qual_corr.update(float(vol), float(quality))

    return {
        "n_joined": int(abs_err_corr.n),
        "corr_vol_abs_error": float(abs_err_corr.corr()),
        "corr_vol_rmse": float(rmse_corr.corr()),
        "corr_vol_model_quality": float(qual_corr.corr()),
        "directional_accuracy": float(dir_ok / dir_n) if dir_n else 0.0,
        "rmse_window": int(rmse_window),
        "notes": "model_quality is derived deterministically from rolling RMSE; correlation signs depend on dataset scale.",
    }


def compute_topk_lift(
    *,
    val_predictions_csv: Path,
    top_k: int = 5,
) -> dict:
    """
    Backtest-style validation (selection lift):
    For each date:
    - baseline: avg y_true across all symbols
    - strategy: avg y_true among top_k symbols by y_pred
    Compute mean lift and win-rate (strategy > baseline).
    """
    # date -> list[(y_true, y_pred)]
    by_date: Dict[dt.date, List[Tuple[float, float]]] = {}
    with val_predictions_csv.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            d = _parse_date(row.get("date", ""))
            y_true = _safe_float(row.get("y_true", ""))
            y_pred = _safe_float(row.get("y_pred", ""))
            if d is None or y_true is None or y_pred is None:
                continue
            by_date.setdefault(d, []).append((float(y_true), float(y_pred)))

    lifts: List[float] = []
    baselines: List[float] = []
    wins = 0
    for d in sorted(by_date.keys()):
        rows = by_date[d]
        if len(rows) < max(3, top_k):
            continue
        baseline = float(sum(y for (y, _p) in rows) / float(len(rows)))
        baselines.append(baseline)
        rows_sorted = sorted(rows, key=lambda x: x[1], reverse=True)
        top = rows_sorted[: int(top_k)]
        strat = float(sum(y for (y, _p) in top) / float(len(top)))
        lift = strat - baseline
        lifts.append(lift)
        if lift > 0:
            wins += 1

    return {
        "top_k": int(top_k),
        "n_days": int(len(lifts)),
        "avg_baseline": float(np.mean(baselines)) if baselines else 0.0,
        "avg_lift": float(np.mean(lifts)) if lifts else 0.0,
        "win_rate": float(wins / len(lifts)) if lifts else 0.0,
        "notes": "Lift compares average y_true of top-k by y_pred vs daily baseline (all symbols).",
    }


def compute_market_regime_from_proxy_index(
    history_clean_csv: Path,
    *,
    lookback_days: int = 60,
) -> dict:
    """
    Build a VN30 equal-weight proxy index from cleaned OHLCV and infer regime.
    """
    # Build date -> list closes
    date_to_closes: Dict[dt.date, List[float]] = {}
    with history_clean_csv.open("r", encoding="utf-8", newline="") as f:
        r = csv.DictReader(f)
        for row in r:
            d = _parse_date(row.get("date", "")) or _parse_date(row.get("time", ""))
            sym = (row.get("symbol") or "").strip().upper()
            c = _safe_float(row.get("close", ""))
            if d is None or not sym or c is None or c <= 0:
                continue
            date_to_closes.setdefault(d, []).append(float(c))

    dates = sorted(date_to_closes.keys())
    dates = dates[-int(lookback_days) :]
    if len(dates) < 10:
        return {"label": "unknown", "lookback_days": int(lookback_days)}

    idx = []
    for d in dates:
        closes = date_to_closes.get(d, [])
        if not closes:
            continue
        idx.append(float(sum(closes) / float(len(closes))))
    if len(idx) < 10:
        return {"label": "unknown", "lookback_days": int(lookback_days)}

    arr = np.array(idx, dtype=float)
    rets = np.diff(arr) / np.where(arr[:-1] > 0, arr[:-1], 1.0)
    vol = float(np.std(rets)) if len(rets) >= 2 else 0.0
    ret20 = float((arr[-1] / arr[max(0, len(arr) - 21)] - 1.0)) if len(arr) >= 21 else float(arr[-1] / arr[0] - 1.0)
    peak = float(arr[0])
    mdd = 0.0
    for v in arr:
        if v > peak:
            peak = float(v)
        dd = (peak - float(v)) / peak if peak > 0 else 0.0
        mdd = max(mdd, dd)

    # simple regime rule
    if ret20 > 0.03 and vol < 0.02:
        label = "bull"
    elif ret20 < -0.03 and vol < 0.02:
        label = "bear"
    elif vol >= 0.02:
        label = "high_vol"
    else:
        label = "sideways"

    return {
        "label": label,
        "lookback_days": int(lookback_days),
        "ret_20d": float(ret20),
        "vol_daily": float(vol),
        "max_drawdown": float(mdd),
        "asof": dates[-1].isoformat(),
    }


def build_knowledge_summary(
    *,
    dataset_csv: Path,
    dataset_meta_json: Path,
    val_predictions_csv: Optional[Path],
    vn30_history_clean_csv: Path,
    max_rows_for_corr: Optional[int] = None,
) -> dict:
    meta = load_dataset_meta(dataset_meta_json)
    cols: List[str] = list(meta.get("columns", []))
    target_col = "y_future_return"
    feature_cols = [c for c in cols if c not in {"date", "symbol", target_col}]

    corrs = compute_feature_correlations(dataset_csv, features=feature_cols, target_col=target_col, max_rows=max_rows_for_corr)
    ranked = sorted(corrs.items(), key=lambda kv: abs(kv[1]), reverse=True)
    top = ranked[:12]

    by_group: Dict[str, List[Tuple[str, float]]] = {}
    for f, c in ranked:
        by_group.setdefault(group_for_feature(f), []).append((f, c))

    group_summary = {}
    for g, items in by_group.items():
        # strongest 3 by absolute correlation
        items2 = sorted(items, key=lambda kv: abs(kv[1]), reverse=True)[:3]
        group_summary[g] = [{"feature": f, "corr": float(c)} for f, c in items2]

    sentiment_bins = compute_sentiment_bins_effect(dataset_csv)
    regime = compute_market_regime_from_proxy_index(vn30_history_clean_csv, lookback_days=90)

    err_rel = None
    lift = None
    if val_predictions_csv and val_predictions_csv.exists():
        err_rel = compute_error_vs_vol_relation(val_predictions_csv=val_predictions_csv, dataset_csv=dataset_csv, rmse_window=60)
        lift = compute_topk_lift(val_predictions_csv=val_predictions_csv, top_k=5)

    return {
        "asof": regime.get("asof"),
        "market_regime": regime,
        "feature_impact": {
            "top_abs_corr": [{"feature": f, "corr": float(c)} for f, c in top],
            "by_group": group_summary,
            "notes": "Correlation is a descriptive statistic (not causality). Used as evidence for explainability.",
        },
        "sentiment_effect": {"bins": sentiment_bins, "sent_col": "sent_7d", "target": target_col},
        "model_error_vs_vol": err_rel,
        "selection_lift_validation": lift,
        "dataset_meta": {
            "rows_out": meta.get("rows_out"),
            "date_range": meta.get("date_range"),
            "spec": meta.get("spec"),
        },
    }


