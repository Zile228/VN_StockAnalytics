"""
Deterministic gating rules.

Filters symbols by:
- liquidity threshold (avg_volume_20d)
- model quality threshold
- uncertainty too large vs expected return (signal-to-noise)
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence


@dataclass(frozen=True, slots=True)
class GatingConfig:
    min_avg_volume_20d: float = 50_000.0
    min_model_quality: float = 0.65
    min_signal_to_noise: float = 0.15  # |expected_return| / (risk) must be >= this


@dataclass(frozen=True, slots=True)
class Candidate:
    symbol: str
    expected_return: float
    risk: float
    liquidity: float
    model_quality: float
    reasons: List[str]


@dataclass(frozen=True, slots=True)
class GatedResult:
    kept: List[Candidate]
    removed: List[Candidate]


def gate_candidates(
    candidates: Sequence[Candidate],
    *,
    cfg: GatingConfig,
) -> GatedResult:
    kept: List[Candidate] = []
    removed: List[Candidate] = []

    for c in candidates:
        reasons = list(c.reasons)
        ok = True
        if c.liquidity < cfg.min_avg_volume_20d:
            ok = False
            reasons.append(f"Filtered: low liquidity avg_volume_20d={c.liquidity:.0f} < {cfg.min_avg_volume_20d:.0f}")
        if c.model_quality < cfg.min_model_quality:
            ok = False
            reasons.append(f"Filtered: low model_quality={c.model_quality:.2f} < {cfg.min_model_quality:.2f}")
        if c.risk <= 0:
            ok = False
            reasons.append("Filtered: non-positive risk proxy")
        else:
            sn = abs(c.expected_return) / c.risk
            if sn < cfg.min_signal_to_noise:
                ok = False
                reasons.append(f"Filtered: low signal_to_noise={sn:.3f} < {cfg.min_signal_to_noise:.3f}")

        cc = Candidate(
            symbol=c.symbol,
            expected_return=c.expected_return,
            risk=c.risk,
            liquidity=c.liquidity,
            model_quality=c.model_quality,
            reasons=reasons,
        )
        (kept if ok else removed).append(cc)

    kept.sort(key=lambda x: (x.expected_return / max(x.risk, 1e-12)), reverse=True)
    return GatedResult(kept=kept, removed=removed)


