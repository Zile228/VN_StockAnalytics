"""
Schema for UI-renderable recommendation output.

Validated via Pydantic (deterministic gating/optimizer numbers must be consistent).
"""

from __future__ import annotations

from typing import List, Literal, Optional

from pydantic import BaseModel, Field, confloat


ActionType = Literal["buy", "sell", "hold"]
OrderType = Literal["limit", "market", "stop_limit"]
TIF = Literal["day", "gtc"]


class UncertaintyBand(BaseModel):
    p10: float
    p50: float
    p90: float


class LadderStep(BaseModel):
    step_pct: float = Field(..., description="Price step in percent vs anchor, e.g. -0.5 means -0.5%")
    size_pct_of_symbol: confloat(ge=0.0, le=1.0)


class OrderPlan(BaseModel):
    order_type: OrderType
    entry_rule: str
    ladder: Optional[List[LadderStep]] = None
    time_in_force: TIF


class RiskControls(BaseModel):
    stop_loss_rule: str
    take_profit_rule: str
    max_loss_pct_portfolio: confloat(ge=0.0, le=0.05)


class RecommendedAction(BaseModel):
    symbol: str
    action: ActionType
    target_weight: confloat(ge=0.0, le=1.0)
    confidence: confloat(ge=0.0, le=1.0)
    expected_return: float
    uncertainty_band: UncertaintyBand
    order_plan: OrderPlan
    risk_controls: RiskControls
    evidence: List[str]
    invalidation: List[str]


class RecommendationOutput(BaseModel):
    horizon_days: int = Field(..., ge=1, le=365)
    recommended_actions: List[RecommendedAction]
    cash_weight: confloat(ge=0.0, le=1.0)
    notes: str


