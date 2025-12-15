"""
FastAPI backend adapter (local-only).

Purpose:
- Provide HTTP endpoints for the web/ frontend to consume orchestrator outputs.
- No database, no external services required.
"""

from __future__ import annotations

import datetime as dt
import math
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from fastapi import Body, FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import config
from src.data_access.loaders import (
    SentimentItem,
    load_news_csv,
    load_sentiment_analyzed_csv,
    load_vn30_history_csv,
)
from src.data_access.news import aggregate_recent_sentiment
from src.data_access.features import compute_symbol_features
from src.data_access.mock_portfolio import get_mock_portfolio
from src.modeling.forecast_bundle import load_val_predictions_forecast
from src.llm_orchestrator.orchestrator import Orchestrator
from src.llm_orchestrator.tools import DisabledLLMClient, LocalFileTools, LocalPaths
from src.knowledge.insights import build_knowledge_summary


def _history_path() -> "config.Path":
    return config.VN30_HISTORY_CLEAN_CSV if config.VN30_HISTORY_CLEAN_CSV.exists() else config.VN30_HISTORY_CSV


@lru_cache(maxsize=1)
def _history_cache() -> Dict[str, list]:
    return load_vn30_history_csv(_history_path())


@lru_cache(maxsize=1)
def _news_cache() -> list:
    if not config.NEWS_MERGED_CSV.exists():
        return []
    return load_news_csv(config.NEWS_MERGED_CSV)


@lru_cache(maxsize=1)
def _sentiment_cache() -> List[SentimentItem]:
    if not config.SENTIMENT_ANALYZED_CSV.exists():
        return []
    return load_sentiment_analyzed_csv(config.SENTIMENT_ANALYZED_CSV)


def _asof_date_from_history() -> dt.date:
    hist = _history_cache()
    last: Optional[dt.date] = None
    for bars in hist.values():
        if not bars:
            continue
        d = bars[-1].date
        if last is None or d > last:
            last = d
    return last or dt.date.today()


def _latest_bar(symbol: str) -> Optional[Any]:
    sym = symbol.upper()
    bars = _history_cache().get(sym, [])
    return bars[-1] if bars else None


def _previous_bar(symbol: str) -> Optional[Any]:
    sym = symbol.upper()
    bars = _history_cache().get(sym, [])
    return bars[-2] if len(bars) >= 2 else None


def _common_aligned_closes(symbols: List[str], start: Optional[dt.date] = None, end: Optional[dt.date] = None) -> Tuple[List[dt.date], np.ndarray]:
    """
    Return (dates, closes_matrix) aligned by intersection of available trading dates.
    closes_matrix has shape [len(dates), len(symbols)].
    """
    syms = [s.upper() for s in symbols]
    per_sym: List[Dict[dt.date, float]] = []
    date_sets: List[set] = []
    for s in syms:
        bars = _history_cache().get(s, [])
        m: Dict[dt.date, float] = {}
        ds: set = set()
        for b in bars:
            if start and b.date < start:
                continue
            if end and b.date > end:
                continue
            if b.close is None:
                continue
            m[b.date] = float(b.close)
            ds.add(b.date)
        per_sym.append(m)
        date_sets.append(ds)

    if not date_sets:
        return ([], np.zeros((0, 0), dtype=float))

    common = set.intersection(*date_sets) if date_sets else set()
    dates = sorted(list(common))
    if not dates:
        return ([], np.zeros((0, len(syms)), dtype=float))

    mat = np.zeros((len(dates), len(syms)), dtype=float)
    for j, m in enumerate(per_sym):
        for i, d in enumerate(dates):
            mat[i, j] = float(m.get(d, 0.0))
    return (dates, mat)


def _rebalance_step_days(period: str) -> int:
    # approximate trading days
    if period == "daily":
        return 1
    if period == "weekly":
        return 5
    if period == "monthly":
        return 21
    return 5


class PortfolioOptimizeRequest(BaseModel):
    symbols: List[str] = Field(..., min_length=2)
    lookback_days: int = Field(252, ge=30, le=5000)
    n_portfolios: int = Field(500, ge=50, le=20000)
    seed: int = Field(42, ge=0, le=1_000_000)


class BacktestRunRequest(BaseModel):
    symbols: List[str] = Field(..., min_length=1)
    weights: Dict[str, float] = Field(..., description="Symbol->weight, should sum to 1 (approximately).")
    start: Optional[str] = Field(None, description="YYYY-MM-DD")
    end: Optional[str] = Field(None, description="YYYY-MM-DD")
    initial_capital: float = Field(100_000_000.0, gt=0)
    rebalance_period: str = Field("weekly", description="daily|weekly|monthly")


def _tech_features_for_symbol(symbol: str) -> Dict[str, Any]:
    """
    Mirrors frontend StockExplorer "PredictionFeatures" style, using history only.
    """
    sym = symbol.upper()
    hist = _history_cache().get(sym, [])
    if len(hist) < 15:
        return {
            "return1d": 0.0,
            "return3d": 0.0,
            "ma5": 0.0,
            "ma10": 0.0,
            "volatility": 0.0,
            "momentum": 0.0,
            "rsi": 50.0,
        }
    close = [b.close for b in hist]

    def ma(k: int) -> float:
        if len(close) < k:
            return float(close[-1])
        s = sum(close[-k:])
        return float(s / k)

    # daily returns (last 14)
    rets: List[float] = []
    for i in range(max(1, len(close) - 15), len(close)):
        c0 = close[i - 1]
        c1 = close[i]
        rets.append((c1 - c0) / c0 if c0 else 0.0)

    ret1d = rets[-1] if rets else 0.0
    ret3d = (close[-1] - close[-4]) / close[-4] if len(close) >= 4 and close[-4] else 0.0
    ma5 = ma(5)
    ma10 = ma(10)
    current = float(close[-1])

    # volatility std of last 10 returns
    r10 = rets[-10:] if len(rets) >= 2 else rets
    if len(r10) >= 2:
        m = sum(r10) / len(r10)
        var = sum((x - m) ** 2 for x in r10) / len(r10)
        vol = float(math.sqrt(var))
    else:
        vol = 0.0

    # momentum vs MA10
    momentum = (current - ma10) / ma10 if ma10 else 0.0

    # RSI(14) simplified
    gains = sum(x for x in rets if x > 0)
    losses = sum(-x for x in rets if x < 0)
    avg_gain = gains / max(1, len(rets))
    avg_loss = losses / max(1, len(rets)) or 1e-6
    rs = avg_gain / avg_loss
    rsi = 100.0 - (100.0 / (1.0 + rs))

    return {
        "return1d": float(ret1d),
        "return3d": float(ret3d),
        "ma5": float(ma5),
        "ma10": float(ma10),
        "volatility": float(vol),
        "momentum": float(momentum),
        "rsi": float(rsi),
    }


def create_app() -> FastAPI:
    app = FastAPI(title="VN_StockAnalytics API", version="0.1.0")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/api/health")
    def health() -> dict:
        return {"ok": True}

    @app.get("/api/stocks")
    def list_stocks() -> dict:
        """
        Minimal ticker list for UI dropdown.
        """
        symbols = sorted(list(_history_cache().keys()))
        # Provide name/sector placeholders (UI can enrich client-side if needed)
        return {
            "asof": _asof_date_from_history().isoformat(),
            "symbols": [{"symbol": s, "name": s, "sector": None} for s in symbols],
        }

    @app.get("/api/stocks/{symbol}/history")
    def stock_history(
        symbol: str,
        start: Optional[str] = Query(None, description="YYYY-MM-DD"),
        end: Optional[str] = Query(None, description="YYYY-MM-DD"),
        limit: int = Query(200, ge=10, le=5000),
    ) -> dict:
        sym = symbol.upper()
        bars = _history_cache().get(sym, [])
        if not bars:
            return {"symbol": sym, "rows": []}

        start_d = dt.date.fromisoformat(start) if start else None
        end_d = dt.date.fromisoformat(end) if end else None
        filtered = []
        for b in bars:
            if start_d and b.date < start_d:
                continue
            if end_d and b.date > end_d:
                continue
            filtered.append(b)

        # keep last `limit`
        filtered = filtered[-limit:]
        rows = [
            {
                "date": b.date.isoformat(),
                "open": b.open,
                "high": b.high,
                "low": b.low,
                "close": b.close,
                "volume": b.volume,
            }
            for b in filtered
        ]
        return {"symbol": sym, "rows": rows}

    @app.get("/api/stocks/{symbol}/latest")
    def stock_latest(symbol: str) -> dict:
        sym = symbol.upper()
        bars = _history_cache().get(sym, [])
        if not bars:
            return {"symbol": sym, "latest": None}
        last = bars[-1]
        prev = bars[-2] if len(bars) >= 2 else None
        change = ((last.close - prev.close) / prev.close) if (prev and prev.close) else None
        return {
            "symbol": sym,
            "latest": {
                "date": last.date.isoformat(),
                "open": last.open,
                "high": last.high,
                "low": last.low,
                "close": last.close,
                "volume": last.volume,
                "change": change,
            },
        }

    @app.get("/api/stocks/{symbol}/features")
    def stock_features(symbol: str) -> dict:
        """
        Technical features to display in Stock Explorer (MA/RSI/vol/...).
        """
        sym = symbol.upper()
        return {"symbol": sym, "features": _tech_features_for_symbol(sym)}

    @app.get("/api/stocks/{symbol}/news")
    def stock_news(
        symbol: str,
        lookback_days: int = Query(30, ge=1, le=365),
        limit: int = Query(20, ge=1, le=200),
    ) -> dict:
        """
        Join news (bronze) with sentiment (silver) for Stock Explorer.
        """
        sym = symbol.upper()
        asof = dt.datetime.combine(_asof_date_from_history(), dt.time(23, 59, 0))
        start = asof - dt.timedelta(days=int(lookback_days))

        # Build sentiment index by (symbol, title) newest-first within window
        sent = [s for s in _sentiment_cache() if s.symbol == sym and start <= s.published_at <= asof]
        sent_by_title: Dict[str, SentimentItem] = {}
        for s in sorted(sent, key=lambda x: x.published_at, reverse=True):
            if s.title and s.title not in sent_by_title:
                sent_by_title[s.title] = s

        news = [n for n in _news_cache() if n.symbol == sym and start <= n.published_at <= asof]
        news_sorted = sorted(news, key=lambda x: x.published_at, reverse=True)[: int(limit)]

        rows = []
        for n in news_sorted:
            s = sent_by_title.get(n.title)
            rows.append(
                {
                    "published_at": n.published_at.isoformat(),
                    "title": n.title,
                    "sapo": n.sapo,
                    "source": n.source,
                    "url": n.url,
                    "sentiment": (
                        {
                            "sentiment_score": float(s.sentiment_score),
                            "relevance": float(s.relevance),
                            "category": getattr(s, "category", None),
                            "reasoning": s.reasoning,
                            "model_used": getattr(s, "model_used", None),
                        }
                        if s
                        else None
                    ),
                }
            )

        # Aggregate sentiment summary for badge
        sent_agg = aggregate_recent_sentiment(sent, asof=asof, lookback_days=int(lookback_days), max_evidence=3)
        agg = sent_agg.get(sym)
        summary = (
            {
                "avg_score": agg.avg_score,
                "avg_relevance": agg.avg_relevance,
                "n": agg.n,
                "evidence": agg.evidence,
            }
            if agg
            else None
        )
        return {"symbol": sym, "summary": summary, "rows": rows}

    @app.get("/api/stocks/{symbol}/prediction")
    def stock_prediction(
        symbol: str,
        horizon: int = Query(7, ge=1, le=365),
        forecast_source: str = Query("stub"),
    ) -> dict:
        """
        Lightweight prediction endpoint for Stock Explorer:
        - Uses orchestrator forecast source to get expected_return
        - Derives predicted_price from latest close
        """
        sym = symbol.upper()
        bars = _history_cache().get(sym, [])
        if not bars:
            return {"symbol": sym, "prediction": None}
        last = bars[-1]

        expected_return = 0.0
        confidence = 0.5
        if forecast_source == "artifacts" and config.VAL_PREDICTIONS_CSV.exists():
            fb = load_val_predictions_forecast(
                config.VAL_PREDICTIONS_CSV, asof_date=last.date, horizon_days=int(horizon), rmse_window=60
            )
            fp = fb.get(sym)
            if fp:
                expected_return = float(fp.expected_return)
                confidence = float(fp.model_quality)
        else:
            # stub: momentum-based quick proxy
            feats = compute_symbol_features({sym: bars})
            if sym in feats:
                expected_return = float(feats[sym].return_5d)
                confidence = 0.55

        predicted_price = float(last.close) * (1.0 + float(expected_return))
        direction = "neutral"
        if expected_return > 0.005:
            direction = "up"
        elif expected_return < -0.005:
            direction = "down"

        return {
            "symbol": sym,
            "prediction": {
                "predictedReturn": float(expected_return),
                "predictedPrice": float(predicted_price),
                "confidence": float(confidence),
                "direction": direction,
                "asof": last.date.isoformat(),
                "horizon_days": int(horizon),
            },
        }

    @app.get("/api/recommend")
    def recommend(
        user_id: str = Query(...),
        horizon: int = Query(7, ge=1, le=365),
        top_n: int = Query(5, ge=1, le=30),
        fund_lag_quarters: int = Query(0, ge=0, le=8),
        forecast_source: str = Query("stub"),
        risk_profile: Optional[str] = Query(None, description="Override mock portfolio risk_profile: conservative|moderate|aggressive"),
    ) -> dict:
        tools = LocalFileTools(
            LocalPaths(
                base_dir=config.BASE_DIR,
                vn30_history_csv=config.VN30_HISTORY_CSV,
                vn30_history_clean_csv=config.VN30_HISTORY_CLEAN_CSV,
                news_csv=config.NEWS_MERGED_CSV,
                sentiment_csv=config.SENTIMENT_ANALYZED_CSV,
                macro_xlsx=config.MACRO_XLSX,
                usdvnd_csv=config.USDVND_CSV,
                usdvnd_gold_csv=config.USDVND_GOLD_CSV,
                bank_xlsx=config.BANK_XLSX,
                fundamentals_long_csv=config.FUNDAMENTALS_LONG_CSV,
                val_predictions_csv=config.VAL_PREDICTIONS_CSV if forecast_source == "artifacts" else None,
            )
        )
        orch = Orchestrator(tools=tools, llm=DisabledLLMClient())
        # Optional: override risk profile deterministically (useful for Advisory UI)
        if risk_profile:
            pf = get_mock_portfolio(user_id)
            pf.risk_profile = str(risk_profile)
            # monkeypatch tools portfolio getter in this simple adapter
            tools.get_portfolio = lambda _uid: pf  # type: ignore[assignment]

        out = orch.recommend(
            user_id=user_id,
            horizon_days=int(horizon),
            top_n=int(top_n),
            fund_lag_quarters=int(fund_lag_quarters),
            forecast_source=str(forecast_source),
        )
        return out.model_dump()

    @lru_cache(maxsize=1)
    def _knowledge_cache() -> dict:
        dataset_csv = config.MODEL_DATASET_H7_CSV
        meta_json = config.MODEL_DATASET_H7_META_JSON
        history_clean = config.VN30_HISTORY_CLEAN_CSV if config.VN30_HISTORY_CLEAN_CSV.exists() else config.VN30_HISTORY_CSV
        val_pred = config.VAL_PREDICTIONS_CSV if config.VAL_PREDICTIONS_CSV.exists() else None
        if not dataset_csv.exists() or not meta_json.exists():
            return {"error": "missing_dataset", "dataset_csv": str(dataset_csv), "meta_json": str(meta_json)}
        return build_knowledge_summary(
            dataset_csv=dataset_csv,
            dataset_meta_json=meta_json,
            val_predictions_csv=val_pred,
            vn30_history_clean_csv=history_clean,
            max_rows_for_corr=None,
        )

    @app.get("/api/knowledge/summary")
    def knowledge_summary() -> dict:
        """
        Knowledge & Reasoning Layer (deterministic):
        market regime + feature impact evidence + sentiment effect + robustness validation.
        """
        return _knowledge_cache()

    @app.get("/api/knowledge/symbol/{symbol}")
    def knowledge_symbol(
        symbol: str,
        horizon: int = Query(7, ge=1, le=365),
        rmse_window: int = Query(60, ge=10, le=365),
    ) -> dict:
        """
        Symbol-level explainability snapshot (deterministic):
        - latest technical features (ATR/vol/avg volume)
        - forecast point from artifacts (expected_return / uncertainty_sigma / model_quality) if available
        """
        sym = symbol.upper()
        bars = _history_cache().get(sym, [])
        if not bars:
            return {"symbol": sym, "error": "unknown_symbol"}
        asof = bars[-1].date

        feats = compute_symbol_features({sym: bars}).get(sym)
        tech = (
            {
                "return_5d": float(feats.return_5d),
                "realized_vol_20d": float(feats.realized_vol_20d),
                "atr_14": float(feats.atr_14),
                "avg_volume_20d": float(feats.avg_volume_20d),
            }
            if feats
            else None
        )

        fp = None
        if config.VAL_PREDICTIONS_CSV.exists():
            fb = load_val_predictions_forecast(config.VAL_PREDICTIONS_CSV, asof_date=asof, horizon_days=int(horizon), rmse_window=int(rmse_window))
            f = fb.get(sym)
            if f:
                fp = {
                    "asof": f.asof_date.isoformat(),
                    "horizon_days": int(f.horizon_days),
                    "expected_return": float(f.expected_return),
                    "uncertainty_sigma": float(f.uncertainty_sigma),
                    "model_quality": float(f.model_quality),
                    "source": f.source,
                }

        return {"symbol": sym, "asof": asof.isoformat(), "technical": tech, "forecast": fp}

    @app.get("/api/dashboard/overview")
    def dashboard_overview(limit: int = Query(60, ge=10, le=2000)) -> dict:
        """
        Market dashboard overview computed from VN30 history (no external VNINDEX feed).
        Returns an equal-weight VN30 proxy index series + breadth stats.
        """
        hist = _history_cache()
        syms = sorted(list(hist.keys()))
        asof = _asof_date_from_history()

        # Build union of last `limit` dates, then compute equal-weight average close
        date_union: set = set()
        close_by_sym: Dict[str, Dict[dt.date, float]] = {}
        vol_by_sym: Dict[str, Dict[dt.date, float]] = {}
        for s in syms:
            bars = hist.get(s, [])
            if not bars:
                continue
            # keep last few to limit work
            tail = bars[-int(limit) * 2 :] if len(bars) > int(limit) * 2 else bars
            cm: Dict[dt.date, float] = {}
            vm: Dict[dt.date, float] = {}
            for b in tail:
                cm[b.date] = float(b.close)
                vm[b.date] = float(b.volume)
                date_union.add(b.date)
            close_by_sym[s] = cm
            vol_by_sym[s] = vm

        dates = sorted(list(date_union))[-int(limit) :]
        index_rows: List[dict] = []
        base = None
        for d in dates:
            closes = [close_by_sym[s].get(d) for s in syms if s in close_by_sym]
            closes = [c for c in closes if isinstance(c, (int, float)) and c > 0]
            if not closes:
                continue
            avg_close = float(sum(closes) / len(closes))
            if base is None:
                base = avg_close or 1.0
            idx = 1000.0 * (avg_close / base) if base else 1000.0
            total_vol = 0.0
            for s in syms:
                total_vol += float(vol_by_sym.get(s, {}).get(d, 0.0))
            index_rows.append({"date": d.isoformat(), "close": idx, "volume": total_vol})

        # Latest stats per symbol
        rows = []
        gainers = 0
        losers = 0
        unchanged = 0
        total_vol_latest = 0.0
        for s in syms:
            last = _latest_bar(s)
            prev = _previous_bar(s)
            if not last:
                continue
            change = ((last.close - prev.close) / prev.close) if (prev and prev.close) else 0.0
            if change > 0:
                gainers += 1
            elif change < 0:
                losers += 1
            else:
                unchanged += 1
            total_vol_latest += float(last.volume or 0.0)
            rows.append(
                {
                    "symbol": s,
                    "close": float(last.close),
                    "change": float(change),
                    "volume": float(last.volume),
                    "sector": None,
                    "name": s,
                }
            )

        return {
            "asof": asof.isoformat(),
            "index_series": index_rows,
            "breadth": {"gainers": gainers, "losers": losers, "unchanged": unchanged},
            "total_volume": float(total_vol_latest),
            "rows": rows,
        }

    @app.post("/api/portfolio/optimize")
    def portfolio_optimize(payload: PortfolioOptimizeRequest = Body(...)) -> dict:
        """
        Deterministic Monte Carlo Markowitz-style optimizer (seeded).
        Uses equal-date intersection alignment and returns:
        - max_sharpe portfolio
        - min_vol portfolio
        - frontier point cloud (n_portfolios)
        """
        symbols = [s.upper() for s in payload.symbols]
        asof = _asof_date_from_history()
        (dates, closes) = _common_aligned_closes(symbols)
        if closes.shape[0] < 40:
            return {"asof": asof.isoformat(), "symbols": symbols, "error": "not_enough_history"}

        # lookback
        n = closes.shape[0]
        lb = int(payload.lookback_days)
        start_i = max(0, n - (lb + 1))
        closes = closes[start_i:, :]

        # returns
        prev = closes[:-1, :]
        curr = closes[1:, :]
        with np.errstate(divide="ignore", invalid="ignore"):
            rets = np.where(prev > 0, (curr / prev) - 1.0, 0.0)

        mu = np.mean(rets, axis=0)  # daily
        cov = np.cov(rets.T)  # daily covariance
        n_assets = len(symbols)

        rf = 0.05  # annual risk-free
        rng = np.random.default_rng(int(payload.seed))

        def sample_weights(k: int) -> np.ndarray:
            # Dirichlet -> weights sum to 1
            w = rng.dirichlet(np.ones(k))
            return w.astype(float)

        frontier: List[dict] = []
        best_sharpe = None
        best_minvol = None

        for _ in range(int(payload.n_portfolios)):
            w = sample_weights(n_assets)
            ann_ret = float(np.dot(mu, w) * 252.0)
            ann_vol = float(np.sqrt(np.dot(w, np.dot(cov, w))) * np.sqrt(252.0))
            sharpe = float((ann_ret - rf) / ann_vol) if ann_vol > 0 else 0.0
            w_obj = {symbols[i]: float(round(w[i], 6)) for i in range(n_assets)}
            point = {"return": ann_ret, "volatility": ann_vol, "sharpeRatio": sharpe, "weights": w_obj}
            frontier.append(point)

            if best_sharpe is None or point["sharpeRatio"] > best_sharpe["sharpeRatio"]:
                best_sharpe = point
            if best_minvol is None or point["volatility"] < best_minvol["volatility"]:
                best_minvol = point

        return {
            "asof": asof.isoformat(),
            "symbols": symbols,
            "max_sharpe": best_sharpe,
            "min_vol": best_minvol,
            "frontier": frontier,
        }

    @app.post("/api/backtest/run")
    def backtest_run(payload: BacktestRunRequest = Body(...)) -> dict:
        """
        Deterministic backtest using OHLCV closes from VN30 history (no slippage, no fees).
        Produces equity curve and basic performance metrics + simple trade log for rebalances.
        """
        symbols = [s.upper() for s in payload.symbols]
        w_map = {k.upper(): float(v) for k, v in payload.weights.items()}
        start_d = dt.date.fromisoformat(payload.start) if payload.start else None
        end_d = dt.date.fromisoformat(payload.end) if payload.end else None
        (dates, closes) = _common_aligned_closes(symbols, start=start_d, end=end_d)
        if closes.shape[0] < 10:
            return {"symbols": symbols, "error": "not_enough_history", "equityCurve": [], "metrics": None}

        # normalize weights on provided symbols
        w = np.array([w_map.get(s, 0.0) for s in symbols], dtype=float)
        ssum = float(np.sum(w))
        if ssum <= 0:
            w = np.ones(len(symbols), dtype=float) / float(len(symbols))
        else:
            w = w / ssum

        step = _rebalance_step_days(str(payload.rebalance_period))
        initial_capital = float(payload.initial_capital)

        # holdings in shares
        shares = np.zeros(len(symbols), dtype=float)
        trades: List[dict] = []

        p0 = closes[0, :]
        for i, s in enumerate(symbols):
            if p0[i] <= 0:
                continue
            target_value = initial_capital * float(w[i])
            shares[i] = target_value / p0[i]
            trades.append(
                {
                    "date": dates[0].isoformat(),
                    "ticker": s,
                    "action": "buy",
                    "shares": float(shares[i]),
                    "price": float(p0[i]),
                    "value": float(target_value),
                }
            )

        equity_curve: List[dict] = []
        values = []
        last_reb_i = 0

        for t in range(len(dates)):
            px = closes[t, :]
            port_value = float(np.sum(shares * px))
            values.append(port_value)
            equity_curve.append({"date": dates[t].isoformat(), "value": float(round(port_value, 2))})

            # rebalance
            if t > 0 and (t - last_reb_i) >= step:
                for i, s in enumerate(symbols):
                    if px[i] <= 0:
                        continue
                    target_value = port_value * float(w[i])
                    current_value = float(shares[i] * px[i])
                    diff = target_value - current_value
                    if abs(diff) <= port_value * 0.01:
                        continue
                    share_diff = diff / float(px[i])
                    shares[i] += share_diff
                    trades.append(
                        {
                            "date": dates[t].isoformat(),
                            "ticker": s,
                            "action": "rebalance",
                            "shares": float(abs(share_diff)),
                            "price": float(px[i]),
                            "value": float(abs(diff)),
                        }
                    )
                last_reb_i = t

        # Benchmark: equal-weight hold for selected symbols
        bench_shares = np.zeros(len(symbols), dtype=float)
        if len(symbols) > 0:
            ew = 1.0 / float(len(symbols))
            for i in range(len(symbols)):
                if p0[i] > 0:
                    bench_shares[i] = (initial_capital * ew) / p0[i]
        benchmark = []
        for t in range(len(dates)):
            px = closes[t, :]
            v = float(np.sum(bench_shares * px))
            benchmark.append(float(round(v, 2)))

        # metrics
        vals = np.array(values, dtype=float)
        daily = np.diff(vals) / np.where(vals[:-1] > 0, vals[:-1], 1.0)
        total_return = float((vals[-1] - initial_capital) / initial_capital) if initial_capital > 0 else 0.0
        n_days = max(1, len(daily))
        annualized = float((1.0 + total_return) ** (252.0 / n_days) - 1.0) if n_days > 0 else 0.0
        vol = float(np.std(daily) * np.sqrt(252.0)) if len(daily) >= 2 else 0.0
        rf = 0.05
        sharpe = float((annualized - rf) / vol) if vol > 0 else 0.0

        peak = vals[0]
        max_dd = 0.0
        for v in vals:
            if v > peak:
                peak = v
            dd = (peak - v) / peak if peak > 0 else 0.0
            if dd > max_dd:
                max_dd = dd
        win_rate = float(np.mean(daily > 0)) if len(daily) > 0 else 0.0

        comparison = [{"date": dates[i].isoformat(), "portfolio": equity_curve[i]["value"], "benchmark": benchmark[i]} for i in range(len(dates))]

        return {
            "symbols": symbols,
            "equityCurve": equity_curve,
            "comparison": comparison,
            "metrics": {
                "totalReturn": float(round(total_return, 6)),
                "annualizedReturn": float(round(annualized, 6)),
                "volatility": float(round(vol, 6)),
                "sharpeRatio": float(round(sharpe, 4)),
                "maxDrawdown": float(round(max_dd, 6)),
                "winRate": float(round(win_rate, 6)),
                "totalTrades": int(len(trades)),
            },
            "trades": trades,
        }

    return app


app = create_app()


