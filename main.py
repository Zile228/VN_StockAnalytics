"""
CLI entrypoint.

Commands:
- recommend: deterministic recommendation JSON (LLM optional)
- (legacy) run: crawl->preprocess->sentiment (existing pipeline)
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path

import config


def legacy_pipeline() -> None:
    # Keep existing behavior for the old ETL/NLP pipeline.
    from src.news_crawler import get_market_news
    from src.news_sentiment import run_sentiment_analysis
    from src.preprocessing import load_and_preprocess

    print("=== BẮT ĐẦU QUÁ TRÌNH THU THẬP & PHÂN TÍCH DỮ LIỆU ===")

    raw_data_path = get_market_news()
    if not os.path.exists(raw_data_path):
        print("Dừng chương trình do không có dữ liệu đầu vào.")
        return

    df_clean = load_and_preprocess(raw_data_path)
    if df_clean.empty:
        print("Dữ liệu sau khi làm sạch bị rỗng.")
        return

    output_file = config.DATA_PROCESSED_DIR / "VN30_Sentiment_Analyzed.csv"
    df_final = run_sentiment_analysis(df_clean, output_file=output_file)
    df_final.to_csv(output_file, index=False, encoding="utf-8-sig")

    print("\n=== HOÀN TẤT ===")
    print(f"Kết quả đã được lưu tại: {output_file}")


def recommend_cmd(args: argparse.Namespace) -> int:
    from src.llm_orchestrator.orchestrator import Orchestrator
    from src.llm_orchestrator.schema import RecommendationOutput
    from src.llm_orchestrator.tools import DisabledLLMClient, LocalFileTools, LocalPaths

    tools = LocalFileTools(
        LocalPaths(
            base_dir=config.BASE_DIR,
            vn30_history_csv=config.VN30_HISTORY_CSV,
            news_csv=config.NEWS_MERGED_CSV,
            sentiment_csv=config.SENTIMENT_ANALYZED_CSV,
            macro_xlsx=config.MACRO_XLSX,
            usdvnd_csv=config.USDVND_CSV,
        )
    )

    # For now: LLM client is disabled by default (deterministic templates).
    llm = DisabledLLMClient()
    orch = Orchestrator(tools=tools, llm=llm)

    out: RecommendationOutput = orch.recommend(
        user_id=str(args.user_id),
        horizon_days=int(args.horizon),
        top_n=int(args.top_n),
    )

    payload = out.model_dump()
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    print(text)

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = config.OUTPUT_DIR / f"recommendation_{ts}.json"
    out_path.write_text(text, encoding="utf-8")
    print(f"\nSaved: {out_path}")
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="VN_StockAnalytics", description="VN Stock Analytics CLI")
    sub = p.add_subparsers(dest="command")

    pr = sub.add_parser("recommend", help="Generate trade recommendations as JSON")
    pr.add_argument("--user_id", required=True)
    pr.add_argument("--horizon", type=int, default=7, help="Forecast horizon (days)")
    pr.add_argument("--top_n", type=int, default=5, help="Top-N symbols to allocate")
    pr.set_defaults(func=recommend_cmd)

    pl = sub.add_parser("run", help="Legacy crawl->preprocess->sentiment pipeline")
    pl.set_defaults(func=lambda _args: (legacy_pipeline() or 0))
    return p


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()
    if not getattr(args, "command", None):
        # default: keep legacy behavior
        legacy_pipeline()
        return 0
    return int(args.func(args))


if __name__ == "__main__":
    raise SystemExit(main())