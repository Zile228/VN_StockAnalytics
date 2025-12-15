"""
Tool interface + local implementations (mock API layer).

No external services are required; everything loads from local files.
LLM integration is optional; if disabled, returns rule-based templates.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Dict, List, Optional, Protocol, Sequence

from src.data_access.loaders import (
    MacroPoint,
    NewsItem,
    OHLCVBar,
    SentimentItem,
    load_macro_xlsx,
    load_news_csv,
    load_sentiment_analyzed_csv,
    load_usdvnd_csv,
    load_vn30_history_csv,
)
from src.data_access.mock_portfolio import Portfolio, get_mock_portfolio


class DataTools(Protocol):
    def get_portfolio(self, user_id: str) -> Portfolio: ...

    def load_history(self) -> Dict[str, List[OHLCVBar]]: ...

    def load_news(self) -> List[NewsItem]: ...

    def load_sentiment(self) -> List[SentimentItem]: ...

    def load_macro(self) -> List[MacroPoint]: ...

    def load_usdvnd(self) -> List[tuple]: ...


@dataclass(frozen=True, slots=True)
class LocalPaths:
    base_dir: Path
    vn30_history_csv: Path
    news_csv: Path
    sentiment_csv: Path
    macro_xlsx: Path
    usdvnd_csv: Path


class LocalFileTools:
    def __init__(self, paths: LocalPaths):
        self._paths = paths

    def get_portfolio(self, user_id: str) -> Portfolio:
        return get_mock_portfolio(user_id)

    def load_history(self) -> Dict[str, List[OHLCVBar]]:
        return load_vn30_history_csv(self._paths.vn30_history_csv)

    def load_news(self) -> List[NewsItem]:
        return load_news_csv(self._paths.news_csv)

    def load_sentiment(self) -> List[SentimentItem]:
        return load_sentiment_analyzed_csv(self._paths.sentiment_csv)

    def load_macro(self) -> List[MacroPoint]:
        if not self._paths.macro_xlsx.exists():
            return []
        return load_macro_xlsx(self._paths.macro_xlsx)

    def load_usdvnd(self) -> List[tuple]:
        if not self._paths.usdvnd_csv.exists():
            return []
        return load_usdvnd_csv(self._paths.usdvnd_csv)


class LLMClient(Protocol):
    def enabled(self) -> bool: ...
    def render_text_fields(self, *, facts_payload: dict) -> dict: ...


class DisabledLLMClient:
    def enabled(self) -> bool:
        return False

    def render_text_fields(self, *, facts_payload: dict) -> dict:
        # Deterministic, template-based fallback.
        return {
            "notes": "LLM disabled: dùng rule-based templates. Vui lòng kiểm tra lại trước khi đặt lệnh.",
            "per_symbol": {
                a["symbol"]: {
                    "entry_rule": a.get("order_plan", {}).get("entry_rule", ""),
                    "invalidation": [
                        "Nếu biến động (vol) tăng mạnh và giá đi ngược thesis.",
                        "Nếu tin tức/sentiment đảo chiều tiêu cực trong 48-72h.",
                    ],
                }
                for a in facts_payload.get("recommended_actions", [])
            },
        }


def deterministic_model_quality(symbol: str) -> float:
    """
    Deterministic pseudo-quality in [0.6, 0.8] based on symbol hash.
    """
    h = hashlib.sha256(symbol.encode("utf-8")).digest()
    x = int.from_bytes(h[:2], "big") / 65535.0
    return 0.6 + 0.2 * x


