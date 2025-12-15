"""
Deterministic allocation optimizer (simple score-based with constraints).

Algorithm:
- Score candidates by expected_return / risk
- Select top_n
- Convert scores -> weights (normalized positive scores)
- Clamp max_weight_per_stock
- Ensure min_cash_weight; leftover goes to cash
- Enforce max_positions
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Sequence


@dataclass(frozen=True, slots=True)
class AllocationConstraints:
    max_weight_per_stock: float
    min_cash_weight: float
    max_positions: int


@dataclass(frozen=True, slots=True)
class AllocationInput:
    symbol: str
    expected_return: float
    risk: float


@dataclass(frozen=True, slots=True)
class AllocationResult:
    weights: Dict[str, float]
    cash_weight: float
    diagnostics: List[str]


def allocate_weights(
    candidates: Sequence[AllocationInput],
    *,
    top_n: int,
    constraints: AllocationConstraints,
) -> AllocationResult:
    diag: List[str] = []
    if top_n <= 0:
        return AllocationResult(weights={}, cash_weight=1.0, diagnostics=["top_n<=0 -> 100% cash"])

    # Filter to positive expected return
    pos = [c for c in candidates if c.expected_return > 0 and c.risk > 0]
    if not pos:
        return AllocationResult(weights={}, cash_weight=1.0, diagnostics=["no positive candidates -> 100% cash"])

    scored = sorted(pos, key=lambda x: (x.expected_return / max(x.risk, 1e-12)), reverse=True)
    k = min(top_n, constraints.max_positions, len(scored))
    picked = scored[:k]

    scores = [max(c.expected_return / max(c.risk, 1e-12), 0.0) for c in picked]
    ssum = sum(scores)
    if ssum <= 0:
        return AllocationResult(weights={}, cash_weight=1.0, diagnostics=["scores sum to 0 -> 100% cash"])

    investable = max(0.0, 1.0 - constraints.min_cash_weight)
    raw = {c.symbol: investable * (sc / ssum) for c, sc in zip(picked, scores)}

    # Clamp max per stock, then renormalize within investable budget
    clamped = {sym: min(w, constraints.max_weight_per_stock) for sym, w in raw.items()}
    used = sum(clamped.values())
    if used > investable and used > 0:
        # scale down proportionally
        scale = investable / used
        clamped = {sym: w * scale for sym, w in clamped.items()}
        used = sum(clamped.values())

    cash = 1.0 - used
    if cash < constraints.min_cash_weight:
        # enforce minimum cash: scale down positions
        target_used = 1.0 - constraints.min_cash_weight
        if used > 0:
            scale = target_used / used
            clamped = {sym: w * scale for sym, w in clamped.items()}
            used = sum(clamped.values())
        cash = 1.0 - used

    diag.append(f"picked={k}/{len(scored)} investable={investable:.3f} used={used:.3f} cash={cash:.3f}")
    return AllocationResult(weights=clamped, cash_weight=float(cash), diagnostics=diag)


