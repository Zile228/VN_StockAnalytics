"""
End-to-end deterministic recommendation pipeline:
load -> features -> forecast stub -> gating -> optimize -> execution -> (LLM optional) -> schema output
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import math
from dataclasses import asdict
from typing import Dict, List, Optional, Sequence, Tuple

from src.data_access.features import (
    SymbolFeatures,
    compute_symbol_features,
    spread_proxy_from_liquidity_and_vol,
    uncertainty_band_from_vol,
)
from src.data_access.news import aggregate_recent_sentiment, pick_recent_news_evidence
from src.data_access.fundamental_features import fundamentals_boost, latest_fundamentals_snapshot
from src.data_access.mock_portfolio import Portfolio
from src.llm_orchestrator.schema import RecommendationOutput, RecommendedAction, UncertaintyBand
from src.llm_orchestrator.tools import DisabledLLMClient, LLMClient, LocalFileTools, deterministic_model_quality
from src.optimizer.allocation import AllocationConstraints, AllocationInput, allocate_weights
from src.rulebase.execution_rules import build_order_plan, build_risk_controls
from src.rulebase.gating import Candidate, GatingConfig, gate_candidates

logger = logging.getLogger(__name__)


def _asof_from_history(history: Dict[str, list]) -> dt.datetime:
    last_date: Optional[dt.date] = None
    for bars in history.values():
        if not bars:
            continue
        d = bars[-1].date
        if last_date is None or d > last_date:
            last_date = d
    if last_date is None:
        return dt.datetime.utcnow()
    # end-of-day timestamp
    return dt.datetime.combine(last_date, dt.time(23, 59, 0))


def _sentiment_to_return_boost(avg_score: float) -> float:
    """
    Map sentiment_score into a small return boost (weekly-ish).
    Observed sentiment_score values look like -2..+2 or similar.
    """
    # normalize into [-1,1]
    s = max(-2.0, min(2.0, float(avg_score)))
    norm = s / 2.0
    return 0.01 * norm  # +/- 1% boost


def _confidence(expected_return: float, risk: float, model_quality: float) -> float:
    if risk <= 0:
        return 0.1
    sn = abs(expected_return) / risk  # signal-to-noise
    # squashed mapping
    base = max(0.0, min(1.0, 0.5 * sn / 0.5))  # sn=0.5 -> 0.5
    conf = 0.4 * model_quality + 0.6 * base
    return float(max(0.0, min(1.0, conf)))


class Orchestrator:
    def __init__(
        self,
        *,
        tools: LocalFileTools,
        llm: Optional[LLMClient] = None,
        gating_cfg: Optional[GatingConfig] = None,
    ):
        self._tools = tools
        self._llm = llm or DisabledLLMClient()
        self._gating_cfg = gating_cfg or GatingConfig()

    def recommend(
        self,
        *,
        user_id: str,
        horizon_days: int,
        top_n: int,
        fund_lag_quarters: int = 0,
        forecast_source: str = "stub",
    ) -> RecommendationOutput:
        portfolio: Portfolio = self._tools.get_portfolio(user_id)
        history = self._tools.load_history()
        if not history:
            raise RuntimeError("No history loaded.")

        asof = _asof_from_history(history)
        feats = compute_symbol_features(history)

        # Load evidence sources
        news_items = self._tools.load_news()
        sent_items = self._tools.load_sentiment()
        sent_agg = aggregate_recent_sentiment(sent_items, asof=asof, lookback_days=7, max_evidence=3)
        news_ev = pick_recent_news_evidence(news_items, asof=asof, lookback_days=7, max_items_per_symbol=2)

        # Optional macro/usd-vnd evidence (portfolio-level)
        macro = self._tools.load_macro()
        usdvnd = self._tools.load_usdvnd()
        fundamentals = self._tools.load_fundamentals_long()
        fundamentals_snap = latest_fundamentals_snapshot(
            fundamentals,
            asof_date=asof.date(),
            lag_quarters=int(fund_lag_quarters),
            preferred_metrics=["roe", "roa", "p_e", "p_b", "eps_vnd", "bvps_vnd"],
        )

        # Optional model forecast bundle (from artifacts)
        forecast_bundle: Dict[str, dict] = {}
        if str(forecast_source).lower() == "artifacts":
            forecast_bundle = self._tools.load_forecast_bundle(asof_date=asof.date(), horizon_days=int(horizon_days))

        # Build forecast stub candidates deterministically
        candidates: List[Candidate] = []
        for sym, f in feats.items():
            sboost = _sentiment_to_return_boost(sent_agg[sym].avg_score) if sym in sent_agg else 0.0
            fboost = fundamentals_boost(fundamentals_snap.get(sym))
            # Forecast source selection:
            # - stub: momentum + sentiment + fundamentals (weak)
            # - artifacts: model expected_return overrides (still deterministic); we keep small blend from other signals
            if forecast_bundle and sym in forecast_bundle:
                model_er = float(forecast_bundle[sym].get("expected_return", 0.0))
                expected_return = 0.85 * model_er + 0.10 * sboost + 0.05 * fboost
                mq = float(forecast_bundle[sym].get("model_quality", deterministic_model_quality(sym)))
            else:
                expected_return = 0.75 * f.return_5d + 0.20 * sboost + 0.05 * fboost
                mq = deterministic_model_quality(sym)
            risk = float(f.realized_vol_20d) * math.sqrt(max(1.0, float(horizon_days)))
            candidates.append(
                Candidate(
                    symbol=sym,
                    expected_return=float(expected_return),
                    risk=float(risk),
                    liquidity=float(f.avg_volume_20d),
                    model_quality=float(mq),
                    reasons=[
                        f"features: return_5d={f.return_5d:.4f}, vol20d={f.realized_vol_20d:.4f}, atr14={f.atr_14:.4f}, avg_vol20d={f.avg_volume_20d:.0f}",
                        f"sentiment_boost={sboost:.4f}",
                        f"fundamentals_boost={fboost:.4f} (lag_quarters={int(fund_lag_quarters)})",
                        f"forecast_source={forecast_source}",
                    ],
                )
            )

        gated = gate_candidates(candidates, cfg=self._gating_cfg)

        alloc_inputs = [AllocationInput(symbol=c.symbol, expected_return=c.expected_return, risk=max(c.risk, 1e-8)) for c in gated.kept]
        alloc_constraints = AllocationConstraints(
            max_weight_per_stock=portfolio.constraints.max_weight_per_stock,
            min_cash_weight=portfolio.constraints.min_cash_weight,
            max_positions=portfolio.constraints.max_positions,
        )
        alloc = allocate_weights(alloc_inputs, top_n=top_n, constraints=alloc_constraints)

        # Decide actions
        held = {p.symbol.upper(): p for p in portfolio.positions}
        actions: List[RecommendedAction] = []

        # Add BUY actions from allocation
        for sym, w in sorted(alloc.weights.items(), key=lambda x: x[1], reverse=True):
            f = feats.get(sym)
            if f is None:
                continue
            c = next((x for x in gated.kept if x.symbol == sym), None)
            if c is None:
                continue
            spread_proxy = spread_proxy_from_liquidity_and_vol(f.avg_volume_20d, f.realized_vol_20d)
            # If model bundle provides uncertainty sigma, prefer it; otherwise use realized vol.
            if forecast_bundle and sym in forecast_bundle and forecast_bundle[sym].get("uncertainty_sigma") is not None:
                sigma = float(forecast_bundle[sym].get("uncertainty_sigma"))
                # approximate uncertainty scaling by sqrt(horizon)
                scale = sigma * math.sqrt(max(1.0, float(horizon_days)))
                p50 = c.expected_return
                p10 = c.expected_return - 1.2816 * scale
                p90 = c.expected_return + 1.2816 * scale
                p10, p50, p90 = float(p10), float(p50), float(p90)
            else:
                p10, p50, p90 = uncertainty_band_from_vol(c.expected_return, f.realized_vol_20d, horizon_days)

            # Deterministic evidence strings
            evidence: List[str] = []
            evidence.append(f"[{sym}] Price asof={asof.date().isoformat()} close={f.last_close:.2f}")
            evidence.append(f"[{sym}] Momentum 5d={f.return_5d:.4f}; vol20d={f.realized_vol_20d:.4f}; ATR14={f.atr_14:.4f}")
            if sym in fundamentals_snap and fundamentals_snap[sym].metrics:
                snap = fundamentals_snap[sym]
                # Keep evidence short and UI-friendly
                kv = ", ".join([f"{k}={v:.4g}" for k, v in list(snap.metrics.items())[:6]])
                evidence.append(f"[{sym}] Fundamentals (Y{snap.year}Q{snap.quarter}): {kv}")
            if sym in sent_agg:
                evidence.extend(sent_agg[sym].evidence)
            if sym in news_ev:
                evidence.extend(news_ev[sym])

            action = "buy"
            order_plan = build_order_plan(
                symbol=sym,
                action=action,
                last_close=f.last_close,
                atr=f.atr_14,
                spread_proxy=spread_proxy,
                profile=portfolio.risk_profile,
                time_in_force="day",
            )
            risk_controls = build_risk_controls(
                action=action,
                entry_reference_price=f.last_close,
                atr=f.atr_14,
                profile=portfolio.risk_profile,
            )
            inv = [
                f"Nếu đóng cửa < (entry - k*ATR) theo rule stop-loss.",
                "Nếu vol regime tăng mạnh (vol20d spike) làm giảm xác suất thesis.",
            ]

            actions.append(
                RecommendedAction(
                    symbol=sym,
                    action=action,
                    target_weight=float(w),
                    confidence=_confidence(c.expected_return, max(c.risk, 1e-8), c.model_quality),
                    expected_return=float(c.expected_return),
                    uncertainty_band=UncertaintyBand(p10=float(p10), p50=float(p50), p90=float(p90)),
                    order_plan={
                        "order_type": order_plan.order_type,
                        "entry_rule": order_plan.entry_rule,
                        "ladder": [asdict(x) for x in order_plan.ladder] if order_plan.ladder else None,
                        "time_in_force": order_plan.time_in_force,
                    },
                    risk_controls={
                        "stop_loss_rule": risk_controls.stop_loss_rule,
                        "take_profit_rule": risk_controls.take_profit_rule,
                        "max_loss_pct_portfolio": risk_controls.max_loss_pct_portfolio,
                    },
                    evidence=evidence,
                    invalidation=inv,
                )
            )

        # Add SELL suggestions for held names that are gated out or have negative expected return
        sell_threshold = -0.01  # -1% expected return signal
        for sym, pos in held.items():
            f = feats.get(sym)
            if f is None:
                continue
            c = next((x for x in candidates if x.symbol == sym), None)
            if c is None:
                continue
            if sym in alloc.weights:
                continue  # already a buy target
            if c.expected_return <= sell_threshold:
                spread_proxy = spread_proxy_from_liquidity_and_vol(f.avg_volume_20d, f.realized_vol_20d)
                p10, p50, p90 = uncertainty_band_from_vol(c.expected_return, f.realized_vol_20d, horizon_days)
                evidence = [
                    f"[{sym}] Held position qty={pos.qty} avg_cost={pos.avg_cost:.2f}",
                    f"[{sym}] Weak signal expected_return={c.expected_return:.4f} (mom+sentiment stub).",
                ]
                order_plan = build_order_plan(
                    symbol=sym,
                    action="sell",
                    last_close=f.last_close,
                    atr=f.atr_14,
                    spread_proxy=spread_proxy,
                    profile=portfolio.risk_profile,
                    time_in_force="day",
                )
                risk_controls = build_risk_controls(
                    action="sell",
                    entry_reference_price=f.last_close,
                    atr=f.atr_14,
                    profile=portfolio.risk_profile,
                )
                actions.append(
                    RecommendedAction(
                        symbol=sym,
                        action="sell",
                        target_weight=0.0,
                        confidence=_confidence(c.expected_return, max(c.risk, 1e-8), c.model_quality),
                        expected_return=float(c.expected_return),
                        uncertainty_band=UncertaintyBand(p10=float(p10), p50=float(p50), p90=float(p90)),
                        order_plan={
                            "order_type": order_plan.order_type,
                            "entry_rule": order_plan.entry_rule,
                            "ladder": [asdict(x) for x in order_plan.ladder] if order_plan.ladder else None,
                            "time_in_force": order_plan.time_in_force,
                        },
                        risk_controls={
                            "stop_loss_rule": risk_controls.stop_loss_rule,
                            "take_profit_rule": risk_controls.take_profit_rule,
                            "max_loss_pct_portfolio": risk_controls.max_loss_pct_portfolio,
                        },
                        evidence=evidence,
                        invalidation=["Nếu tín hiệu đảo chiều tích cực (momentum + sentiment) trong 3-5 phiên."],
                    )
                )

        # LLM optional: only edit textual fields (entry_rule/invalidation/notes)
        facts_payload = {
            "asof": asof.isoformat(),
            "portfolio": {
                "risk_profile": portfolio.risk_profile,
                "constraints": asdict(portfolio.constraints),
            },
            "gating": {
                "kept": [{"symbol": c.symbol, "expected_return": c.expected_return, "risk": c.risk, "liquidity": c.liquidity, "model_quality": c.model_quality} for c in gated.kept],
                "removed": [{"symbol": c.symbol, "reasons": c.reasons} for c in gated.removed],
            },
            "allocation": {"weights": alloc.weights, "cash_weight": alloc.cash_weight, "diagnostics": alloc.diagnostics},
            "recommended_actions": [a.model_dump() for a in actions],
            "macro_tail": [asdict(x) for x in macro[-2:]] if macro else [],
            "usdvnd_tail": usdvnd[-2:] if usdvnd else [],
        }
        if self._llm.enabled():
            rendered = self._llm.render_text_fields(facts_payload=facts_payload)
            per_symbol = rendered.get("per_symbol", {})
            for a in actions:
                if a.symbol in per_symbol:
                    a.order_plan.entry_rule = per_symbol[a.symbol].get("entry_rule", a.order_plan.entry_rule)
                    a.invalidation = per_symbol[a.symbol].get("invalidation", a.invalidation)
            notes = str(rendered.get("notes") or "")
        else:
            notes = (
                "LLM disabled: plan được tạo bằng rulebase + optimizer deterministic. "
                "Hãy kiểm tra lại mức rủi ro/khả năng khớp lệnh trước khi đặt lệnh."
            )

        # Portfolio-level notes: include macro/usd-vnd tail for context (optional)
        if macro:
            last_m = macro[-1]
            notes += f" | Macro: Y{last_m.year}Q{last_m.quarter} INF={last_m.inf_pct} GDP={last_m.gdp_pct} DC={last_m.dc_pct}"
        if usdvnd:
            d, v = usdvnd[-1]
            notes += f" | USDVND last={d.isoformat()} value={v:.2f}"

        out = RecommendationOutput(
            horizon_days=int(horizon_days),
            recommended_actions=actions,
            cash_weight=float(alloc.cash_weight),
            notes=notes,
        )
        return out


