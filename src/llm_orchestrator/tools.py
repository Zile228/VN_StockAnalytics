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
import datetime as dt

from src.data_access.fundamentals import FundamentalRecord, iter_bank_fundamentals_long
from src.data_access.fx import iter_usdvnd_canonical_rows
from src.data_access.mock_portfolio import Portfolio, get_mock_portfolio


class DataTools(Protocol):
    def get_portfolio(self, user_id: str) -> Portfolio: ...

    def load_history(self) -> Dict[str, List[OHLCVBar]]: ...

    def load_news(self) -> List[NewsItem]: ...

    def load_sentiment(self) -> List[SentimentItem]: ...

    def load_macro(self) -> List[MacroPoint]: ...

    def load_usdvnd(self) -> List[tuple]: ...

    def load_fundamentals_long(self) -> List[FundamentalRecord]: ...

    def load_forecast_bundle(self, *, asof_date: dt.date, horizon_days: int) -> Dict[str, dict]: ...


@dataclass(frozen=True, slots=True)
class LocalPaths:
    base_dir: Path
    vn30_history_csv: Path
    vn30_history_clean_csv: Optional[Path]
    news_csv: Path
    sentiment_csv: Path
    macro_xlsx: Path
    usdvnd_csv: Path
    usdvnd_gold_csv: Optional[Path]
    bank_xlsx: Optional[Path]
    fundamentals_long_csv: Optional[Path]
    val_predictions_csv: Optional[Path]


class LocalFileTools:
    def __init__(self, paths: LocalPaths):
        self._paths = paths

    def get_portfolio(self, user_id: str) -> Portfolio:
        return get_mock_portfolio(user_id)

    def load_history(self) -> Dict[str, List[OHLCVBar]]:
        if self._paths.vn30_history_clean_csv and self._paths.vn30_history_clean_csv.exists():
            return load_vn30_history_csv(self._paths.vn30_history_clean_csv)
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
        # Prefer canonical gold output if available
        if self._paths.usdvnd_gold_csv and self._paths.usdvnd_gold_csv.exists():
            out: List[tuple] = []
            for r in iter_usdvnd_canonical_rows(self._paths.usdvnd_gold_csv):
                # r['date'] is YYYY-MM-DD, close float
                try:
                    d = dt.date.fromisoformat(str(r["date"]))
                    v = float(r["close"])
                except Exception:
                    continue
                out.append((d, v))
            out.sort(key=lambda x: x[0])
            return out

        if not self._paths.usdvnd_csv.exists():
            return []
        return load_usdvnd_csv(self._paths.usdvnd_csv)

    def load_fundamentals_long(self) -> List[FundamentalRecord]:
        """
        Prefer pre-built gold long-form CSV if provided; otherwise parse bank.xlsx.
        """
        records: List[FundamentalRecord] = []
        if self._paths.fundamentals_long_csv and self._paths.fundamentals_long_csv.exists():
            # Load from CSV (fast)
            import csv as _csv

            with self._paths.fundamentals_long_csv.open("r", encoding="utf-8", newline="") as f:
                r = _csv.DictReader(f)
                for row in r:
                    try:
                        records.append(
                            FundamentalRecord(
                                symbol=str(row["symbol"]).strip().upper(),
                                year=int(row["year"]),
                                quarter=int(row["quarter"]),
                                statement=str(row["statement"]).strip(),
                                metric=str(row["metric"]).strip(),
                                metric_raw=str(row.get("metric_raw") or "").strip(),
                                value=float(row["value"]),
                            )
                        )
                    except Exception:
                        continue
            return records

        if self._paths.bank_xlsx and self._paths.bank_xlsx.exists():
            for rec in iter_bank_fundamentals_long(self._paths.bank_xlsx):
                records.append(rec)
        return records

    def load_forecast_bundle(self, *, asof_date: dt.date, horizon_days: int) -> Dict[str, dict]:
        """
        Return mapping symbol -> forecast dict with keys:
        expected_return, uncertainty_sigma, model_quality, source, asof_date
        """
        if self._paths.val_predictions_csv and self._paths.val_predictions_csv.exists():
            from src.modeling.forecast_bundle import load_val_predictions_forecast

            fp = load_val_predictions_forecast(
                self._paths.val_predictions_csv,
                asof_date=asof_date,
                horizon_days=int(horizon_days),
                rmse_window=60,
            )
            return {
                sym: {
                    "expected_return": v.expected_return,
                    "uncertainty_sigma": v.uncertainty_sigma,
                    "model_quality": v.model_quality,
                    "source": v.source,
                    "asof_date": v.asof_date.isoformat(),
                }
                for sym, v in fp.items()
            }
        return {}


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


