"""
Mock portfolio contract for local-only orchestration (no external services).
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Literal


RiskProfile = Literal["conservative", "moderate", "aggressive"]


@dataclass(frozen=True, slots=True)
class Position:
    symbol: str
    qty: float
    avg_cost: float


@dataclass(frozen=True, slots=True)
class PortfolioConstraints:
    max_weight_per_stock: float
    min_cash_weight: float
    max_positions: int


@dataclass(frozen=True, slots=True)
class Portfolio:
    cash: float
    positions: List[Position]
    constraints: PortfolioConstraints
    risk_profile: RiskProfile


def get_mock_portfolio(user_id: str) -> Portfolio:
    """
    Deterministic mock portfolio by user_id.
    """
    # Keep it simple/deterministic for demo.
    risk_profile: RiskProfile = "moderate"
    if user_id.lower() in {"demo_conservative", "cons"}:
        risk_profile = "conservative"
    elif user_id.lower() in {"demo_aggressive", "agg"}:
        risk_profile = "aggressive"

    return Portfolio(
        cash=250_000_000.0,  # VND
        positions=[
            Position(symbol="FPT", qty=200.0, avg_cost=95_000.0),
            Position(symbol="VCB", qty=150.0, avg_cost=85_000.0),
        ],
        constraints=PortfolioConstraints(
            max_weight_per_stock=0.25,
            min_cash_weight=0.15,
            max_positions=8,
        ),
        risk_profile=risk_profile,
    )


