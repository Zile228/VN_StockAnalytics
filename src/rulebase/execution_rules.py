"""
Deterministic execution + risk control rules.

- default limit
- if spread proxy high => limit + ladder 3 steps
- SL/TP by ATR with k depending on risk_profile
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal, Optional


RiskProfile = Literal["conservative", "moderate", "aggressive"]
OrderType = Literal["limit", "market", "stop_limit"]
TIF = Literal["day", "gtc"]


@dataclass(frozen=True, slots=True)
class LadderStep:
    step_pct: float
    size_pct_of_symbol: float


@dataclass(frozen=True, slots=True)
class OrderPlan:
    order_type: OrderType
    entry_rule: str
    ladder: Optional[List[LadderStep]]
    time_in_force: TIF


@dataclass(frozen=True, slots=True)
class RiskControls:
    stop_loss_rule: str
    take_profit_rule: str
    max_loss_pct_portfolio: float


def _k_params(profile: RiskProfile) -> tuple[float, float, float]:
    if profile == "conservative":
        return (1.0, 1.5, 0.005)
    if profile == "aggressive":
        return (1.5, 2.5, 0.015)
    return (1.2, 2.0, 0.010)


def build_order_plan(
    *,
    symbol: str,
    action: Literal["buy", "sell", "hold"],
    last_close: float,
    atr: float,
    spread_proxy: float,
    profile: RiskProfile,
    time_in_force: TIF = "day",
) -> OrderPlan:
    """
    spread_proxy: higher => worse microstructure => ladder.
    """
    if action == "hold":
        return OrderPlan(
            order_type="limit",
            entry_rule=f"HOLD: no new entry. Reference last_close={last_close:.2f}.",
            ladder=None,
            time_in_force=time_in_force,
        )

    use_ladder = spread_proxy >= 0.0025
    order_type: OrderType = "limit"
    if use_ladder:
        ladder = [
            LadderStep(step_pct=-0.20, size_pct_of_symbol=0.40),
            LadderStep(step_pct=-0.50, size_pct_of_symbol=0.35),
            LadderStep(step_pct=-1.00, size_pct_of_symbol=0.25),
        ]
        entry_rule = (
            f"{action.upper()} via LIMIT+LADDER: anchor at last_close={last_close:.2f}. "
            f"Place 3-step ladder below anchor (pct steps), sized by % of symbol allocation."
        )
        return OrderPlan(order_type=order_type, entry_rule=entry_rule, ladder=ladder, time_in_force=time_in_force)

    # simple limit entry
    entry_rule = (
        f"{action.upper()} via LIMIT: place near last_close={last_close:.2f} "
        f"(consider slight improvement vs last print)."
    )
    return OrderPlan(order_type=order_type, entry_rule=entry_rule, ladder=None, time_in_force=time_in_force)


def build_risk_controls(
    *,
    action: Literal["buy", "sell", "hold"],
    entry_reference_price: float,
    atr: float,
    profile: RiskProfile,
) -> RiskControls:
    k_sl, k_tp, max_loss_pct = _k_params(profile)
    if action == "hold":
        return RiskControls(
            stop_loss_rule="HOLD: keep existing risk controls; re-evaluate on break of key levels.",
            take_profit_rule="HOLD: consider trimming into strength; re-evaluate on new data.",
            max_loss_pct_portfolio=max_loss_pct,
        )

    # For SELL, SL/TP can be interpreted for short; but we keep generic textual controls.
    if atr <= 0:
        return RiskControls(
            stop_loss_rule=f"{action.upper()}: ATR unavailable; use a fixed % stop (profile={profile}).",
            take_profit_rule=f"{action.upper()}: ATR unavailable; use a fixed % take-profit (profile={profile}).",
            max_loss_pct_portfolio=max_loss_pct,
        )

    if action == "buy":
        sl = entry_reference_price - k_sl * atr
        tp = entry_reference_price + k_tp * atr
        return RiskControls(
            stop_loss_rule=f"StopLoss: set at entry - {k_sl:.1f}*ATR14 => ~{sl:.2f} (ATR14={atr:.2f}).",
            take_profit_rule=f"TakeProfit: set at entry + {k_tp:.1f}*ATR14 => ~{tp:.2f} (ATR14={atr:.2f}).",
            max_loss_pct_portfolio=max_loss_pct,
        )

    # sell
    sl = entry_reference_price + k_sl * atr
    tp = entry_reference_price - k_tp * atr
    return RiskControls(
        stop_loss_rule=f"StopLoss: for SELL, set at entry + {k_sl:.1f}*ATR14 => ~{sl:.2f} (ATR14={atr:.2f}).",
        take_profit_rule=f"TakeProfit: for SELL, set at entry - {k_tp:.1f}*ATR14 => ~{tp:.2f} (ATR14={atr:.2f}).",
        max_loss_pct_portfolio=max_loss_pct,
    )


