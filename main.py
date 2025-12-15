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
            vn30_history_clean_csv=config.VN30_HISTORY_CLEAN_CSV,
            news_csv=config.NEWS_MERGED_CSV,
            sentiment_csv=config.SENTIMENT_ANALYZED_CSV,
            macro_xlsx=config.MACRO_XLSX,
            usdvnd_csv=config.USDVND_CSV,
            usdvnd_gold_csv=config.USDVND_GOLD_CSV,
            bank_xlsx=config.BANK_XLSX,
            fundamentals_long_csv=config.FUNDAMENTALS_LONG_CSV,
            val_predictions_csv=config.VAL_PREDICTIONS_CSV if args.forecast_source == "artifacts" else None,
        )
    )

    # For now: LLM client is disabled by default (deterministic templates).
    llm = DisabledLLMClient()
    orch = Orchestrator(tools=tools, llm=llm)

    out: RecommendationOutput = orch.recommend(
        user_id=str(args.user_id),
        horizon_days=int(args.horizon),
        top_n=int(args.top_n),
        fund_lag_quarters=int(args.fund_lag_quarters),
        forecast_source=str(args.forecast_source),
    )

    payload = out.model_dump()
    text = json.dumps(payload, ensure_ascii=False, indent=2)
    print(text)

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    out_path = config.OUTPUT_DIR / f"recommendation_{ts}.json"
    out_path.write_text(text, encoding="utf-8")
    print(f"\nSaved: {out_path}")
    return 0


def data_quality_cmd(args: argparse.Namespace) -> int:
    from src.data_access.quality_report import build_report, render_markdown

    out_dir = Path(str(args.out_dir))
    out_dir.mkdir(parents=True, exist_ok=True)

    paths = {
        "vn30_history_csv": config.VN30_HISTORY_CSV,
        "news_csv": config.NEWS_MERGED_CSV,
        "sentiment_csv": config.SENTIMENT_ANALYZED_CSV,
        "macro_xlsx": config.MACRO_XLSX,
        "usdvnd_csv": config.USDVND_CSV,
        "bank_xlsx": config.BANK_XLSX,
    }
    report = build_report(paths=paths)
    md = render_markdown(report)

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = out_dir / f"data_quality_{ts}.json"
    md_path = out_dir / f"data_quality_{ts}.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(md, encoding="utf-8")

    print(md)
    print(f"\nSaved: {json_path}")
    print(f"Saved: {md_path}")
    return 0


def ingest_fundamentals_cmd(args: argparse.Namespace) -> int:
    from src.data_access.fundamentals import write_fundamentals_long_csv

    in_path = Path(str(args.in_path))
    out_path = Path(str(args.out_path))
    stats = write_fundamentals_long_csv(in_path, out_path)
    print(json.dumps({"input": str(in_path), "output": str(out_path), "stats": stats}, ensure_ascii=False, indent=2))
    return 0


def ingest_fx_cmd(args: argparse.Namespace) -> int:
    from src.data_access.fx import write_usdvnd_canonical_csv

    in_path = Path(str(args.in_path))
    out_path = Path(str(args.out_path))
    stats = write_usdvnd_canonical_csv(in_path, out_path)
    print(json.dumps({"input": str(in_path), "output": str(out_path), "stats": stats}, ensure_ascii=False, indent=2))
    return 0


def clean_ohlcv_cmd(args: argparse.Namespace) -> int:
    from src.data_access.ohlcv_clean import clean_vn30_history_csv

    in_path = Path(str(args.in_path))
    out_path = Path(str(args.out_path))
    stats = clean_vn30_history_csv(in_path, out_path)
    print(json.dumps({"input": str(in_path), "output": str(out_path), "stats": stats}, ensure_ascii=False, indent=2))
    return 0


def build_dataset_cmd(args: argparse.Namespace) -> int:
    from src.llm_orchestrator.tools import LocalFileTools, LocalPaths
    from src.modeling.dataset_builder import DatasetSpec, build_model_dataset_csv

    out_path = Path(str(args.out_path))
    spec = DatasetSpec(
        horizon_days=int(args.horizon),
        sentiment_lookback_days=int(args.sentiment_lookback_days),
        fund_lag_quarters=int(args.fund_lag_quarters),
        macro_lag_quarters=int(args.macro_lag_quarters),
    )

    tools = LocalFileTools(
        LocalPaths(
            base_dir=config.BASE_DIR,
            vn30_history_csv=config.VN30_HISTORY_CSV,
            vn30_history_clean_csv=config.VN30_HISTORY_CLEAN_CSV,
            news_csv=config.NEWS_MERGED_CSV,
            sentiment_csv=config.SENTIMENT_ANALYZED_CSV,
            macro_xlsx=config.MACRO_XLSX,
            usdvnd_csv=config.USDVND_CSV,
            usdvnd_gold_csv=config.USDVND_GOLD_CSV,
            bank_xlsx=config.BANK_XLSX,
            fundamentals_long_csv=config.FUNDAMENTALS_LONG_CSV,
        )
    )

    history_path = config.VN30_HISTORY_CLEAN_CSV if config.VN30_HISTORY_CLEAN_CSV.exists() else config.VN30_HISTORY_CSV
    fundamentals = tools.load_fundamentals_long()
    meta = build_model_dataset_csv(
        out_csv=out_path,
        spec=spec,
        vn30_history_csv=history_path,
        sentiment_csv=config.SENTIMENT_ANALYZED_CSV if config.SENTIMENT_ANALYZED_CSV.exists() else None,
        fundamentals_records=fundamentals,
        macro_xlsx=config.MACRO_XLSX if config.MACRO_XLSX.exists() else None,
        fx_gold_csv=config.USDVND_GOLD_CSV if config.USDVND_GOLD_CSV.exists() else None,
    )
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    return 0


def knowledge_report_cmd(args: argparse.Namespace) -> int:
    from src.knowledge.report import KnowledgeReportPaths, build_report, render_markdown, write_report

    out_dir = Path(str(args.out_dir))
    out_dir.mkdir(parents=True, exist_ok=True)

    paths = KnowledgeReportPaths(
        dataset_csv=Path(str(args.dataset_csv)),
        dataset_meta_json=Path(str(args.dataset_meta_json)),
        vn30_history_clean_csv=config.VN30_HISTORY_CLEAN_CSV if config.VN30_HISTORY_CLEAN_CSV.exists() else config.VN30_HISTORY_CSV,
        val_predictions_csv=config.VAL_PREDICTIONS_CSV if config.VAL_PREDICTIONS_CSV.exists() else None,
    )

    if not bool(getattr(args, "no_write_files", False)):
        res = write_report(out_dir, paths)
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return 0

    report = build_report(paths)
    md = render_markdown(report)
    print(md)
    return 0


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="VN_StockAnalytics", description="VN Stock Analytics CLI")
    sub = p.add_subparsers(dest="command")

    pr = sub.add_parser("recommend", help="Generate trade recommendations as JSON")
    pr.add_argument("--user_id", required=True)
    pr.add_argument("--horizon", type=int, default=7, help="Forecast horizon (days)")
    pr.add_argument("--top_n", type=int, default=5, help="Top-N symbols to allocate")
    pr.add_argument("--fund_lag_quarters", type=int, default=0, help="Lag fundamentals by N quarters (no-leakage for backtest)")
    pr.add_argument("--forecast_source", choices=["stub", "artifacts"], default="stub", help="Forecast source: stub (rule-based) or artifacts (models/artifacts_h7/val_predictions.csv)")
    pr.set_defaults(func=recommend_cmd)

    pl = sub.add_parser("run", help="Legacy crawl->preprocess->sentiment pipeline")
    pl.set_defaults(func=lambda _args: (legacy_pipeline() or 0))

    pdq = sub.add_parser("data_quality", help="Generate Data Quality Report (JSON/MD) from local data/")
    pdq.add_argument("--out_dir", default=str(config.OUTPUT_DIR), help="Output directory (default: output/)")
    pdq.set_defaults(func=data_quality_cmd)

    pfi = sub.add_parser("ingest_fundamentals", help="Normalize bank.xlsx to canonical long-form CSV in data/gold/")
    pfi.add_argument("--in_path", default=str(config.BANK_XLSX), help="Input bank.xlsx path")
    pfi.add_argument("--out_path", default=str(config.FUNDAMENTALS_LONG_CSV), help="Output CSV path")
    pfi.set_defaults(func=ingest_fundamentals_cmd)

    pfx = sub.add_parser("ingest_fx", help="Normalize USDVND CSV to canonical daily CSV in data/gold/")
    pfx.add_argument("--in_path", default=str(config.USDVND_CSV), help="Input USDVND CSV path")
    pfx.add_argument("--out_path", default=str(config.USDVND_GOLD_CSV), help="Output CSV path")
    pfx.set_defaults(func=ingest_fx_cmd)

    poh = sub.add_parser("clean_ohlcv", help="Validate/clean vn30_history.csv and write to data/gold/")
    poh.add_argument("--in_path", default=str(config.VN30_HISTORY_CSV), help="Input vn30_history.csv path")
    poh.add_argument("--out_path", default=str(config.VN30_HISTORY_CLEAN_CSV), help="Output cleaned CSV path")
    poh.set_defaults(func=clean_ohlcv_cmd)

    pds = sub.add_parser("build_dataset", help="Build model training dataset CSV for Colab (feature engineering)")
    pds.add_argument("--out_path", default=str(config.DATA_GOLD_DIR / "model_dataset_h7.csv"), help="Output dataset CSV path")
    pds.add_argument("--horizon", type=int, default=7, help="Target horizon in trading days")
    pds.add_argument("--fund_lag_quarters", type=int, default=1, help="Lag fundamentals by N quarters (no-leakage)")
    pds.add_argument("--macro_lag_quarters", type=int, default=1, help="Lag macro by N quarters (no-leakage)")
    pds.add_argument("--sentiment_lookback_days", type=int, default=7, help="Sentiment rolling window in calendar days")
    pds.set_defaults(func=build_dataset_cmd)

    pk = sub.add_parser("knowledge_report", help="Generate Knowledge Layer report (JSON/MD) for Data Mining explainability")
    pk.add_argument("--out_dir", default=str(config.OUTPUT_DIR), help="Output directory (default: output/)")
    pk.add_argument("--dataset_csv", default=str(config.MODEL_DATASET_H7_CSV), help="Gold dataset CSV path (default: data/gold/model_dataset_h7.csv)")
    pk.add_argument(
        "--dataset_meta_json",
        default=str(config.MODEL_DATASET_H7_META_JSON),
        help="Dataset meta JSON path (default: data/gold/model_dataset_h7.csv.meta.json)",
    )
    pk.add_argument("--no_write_files", action="store_true", help="Do not write files; print markdown to stdout only")
    pk.set_defaults(func=knowledge_report_cmd)
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