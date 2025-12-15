"""
News/sentiment aggregation and evidence extraction (no pandas).
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional

from .loaders import NewsItem, SentimentItem


@dataclass(frozen=True, slots=True)
class SentimentAggregate:
    symbol: str
    avg_score: float
    avg_relevance: float
    n: int
    evidence: List[str]


def aggregate_recent_sentiment(
    sentiment_items: List[SentimentItem],
    *,
    asof: dt.datetime,
    lookback_days: int = 7,
    max_evidence: int = 3,
) -> Dict[str, SentimentAggregate]:
    """
    Aggregate sentiment scores in the recent lookback window.
    Evidence strings are short, UI-friendly.
    """
    start = asof - dt.timedelta(days=lookback_days)
    by_sym: Dict[str, List[SentimentItem]] = {}
    for it in sentiment_items:
        if it.published_at < start or it.published_at > asof:
            continue
        by_sym.setdefault(it.symbol, []).append(it)

    out: Dict[str, SentimentAggregate] = {}
    for sym, items in by_sym.items():
        if not items:
            continue
        # sort newest first
        items_sorted = sorted(items, key=lambda x: x.published_at, reverse=True)
        scores = [float(x.sentiment_score) for x in items_sorted]
        rel = [float(x.relevance) for x in items_sorted]
        avg_score = sum(scores) / len(scores)
        avg_rel = sum(rel) / len(rel)
        evidence: List[str] = []
        for x in items_sorted[:max_evidence]:
            ts = x.published_at.strftime("%Y-%m-%d %H:%M")
            evidence.append(f"[{sym}] {ts} {x.source}: {x.title} (sent={x.sentiment_score}, rel={x.relevance})")
        out[sym] = SentimentAggregate(
            symbol=sym,
            avg_score=avg_score,
            avg_relevance=avg_rel,
            n=len(items_sorted),
            evidence=evidence,
        )
    return out


def pick_recent_news_evidence(
    news_items: List[NewsItem],
    *,
    asof: dt.datetime,
    lookback_days: int = 7,
    max_items_per_symbol: int = 2,
) -> Dict[str, List[str]]:
    start = asof - dt.timedelta(days=lookback_days)
    by_sym: Dict[str, List[NewsItem]] = {}
    for it in news_items:
        if it.published_at < start or it.published_at > asof:
            continue
        by_sym.setdefault(it.symbol, []).append(it)

    out: Dict[str, List[str]] = {}
    for sym, items in by_sym.items():
        items_sorted = sorted(items, key=lambda x: x.published_at, reverse=True)
        ev: List[str] = []
        for x in items_sorted[:max_items_per_symbol]:
            ts = x.published_at.strftime("%Y-%m-%d %H:%M")
            ev.append(f"[{sym}] {ts} {x.source}: {x.title}")
        out[sym] = ev
    return out


