from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

from src.knowledge.insights import build_knowledge_summary


@dataclass(frozen=True, slots=True)
class KnowledgeReportPaths:
    dataset_csv: Path
    dataset_meta_json: Path
    vn30_history_clean_csv: Path
    val_predictions_csv: Optional[Path]


def render_markdown(report: dict) -> str:
    regime = report.get("market_regime") or {}
    fi = report.get("feature_impact") or {}
    bins = (report.get("sentiment_effect") or {}).get("bins") or []
    err = report.get("model_error_vs_vol") or {}
    lift = report.get("selection_lift_validation") or {}

    def fmt_pct(x: float) -> str:
        return f"{x*100:.2f}%"

    lines = []
    lines.append("# Knowledge Report (Data Mining)")
    lines.append("")
    lines.append(f"- asof: **{report.get('asof', '')}**")
    lines.append("")

    lines.append("## Market regime (proxy VN30 equal-weight)")
    lines.append(f"- label: **{regime.get('label', 'unknown')}**")
    if "ret_20d" in regime:
        lines.append(f"- ret_20d: {fmt_pct(float(regime.get('ret_20d', 0.0)))}")
    if "vol_daily" in regime:
        lines.append(f"- vol_daily: {fmt_pct(float(regime.get('vol_daily', 0.0)))}")
    if "max_drawdown" in regime:
        lines.append(f"- max_drawdown: {fmt_pct(float(regime.get('max_drawdown', 0.0)))}")
    lines.append("")

    lines.append("## Feature impact (evidence)")
    lines.append("Top features by |corr(feature, y_future_return)|:")
    for item in (fi.get("top_abs_corr") or [])[:12]:
        lines.append(f"- {item['feature']}: corr={item['corr']:.4f}")
    lines.append("")

    lines.append("Group highlights:")
    by_group = fi.get("by_group") or {}
    for g, items in by_group.items():
        lines.append(f"- **{g}**:")
        for it in items:
            lines.append(f"  - {it['feature']}: corr={it['corr']:.4f}")
    lines.append("")

    lines.append("## Sentiment effect (conditional)")
    for b in bins:
        lines.append(
            f"- {b['bin']}: n={b['n']}, avg_future_return={fmt_pct(float(b['avg_future_return']))}, win_rate={fmt_pct(float(b['win_rate']))}"
        )
    lines.append("")

    if err:
        lines.append("## Model robustness: volatility vs error/quality")
        lines.append(f"- n_joined: {err.get('n_joined', 0)}")
        lines.append(f"- corr(vol_20d, |error|): {float(err.get('corr_vol_abs_error', 0.0)):.4f}")
        lines.append(f"- corr(vol_20d, rmse): {float(err.get('corr_vol_rmse', 0.0)):.4f}")
        lines.append(f"- corr(vol_20d, model_quality): {float(err.get('corr_vol_model_quality', 0.0)):.4f}")
        lines.append(f"- directional_accuracy: {fmt_pct(float(err.get('directional_accuracy', 0.0)))}")
        lines.append("")

    if lift:
        lines.append("## Backtest-style validation: selection lift (top-k by prediction)")
        lines.append(f"- top_k: {lift.get('top_k')}")
        lines.append(f"- n_days: {lift.get('n_days')}")
        lines.append(f"- avg_lift: {fmt_pct(float(lift.get('avg_lift', 0.0)))}")
        lines.append(f"- win_rate: {fmt_pct(float(lift.get('win_rate', 0.0)))}")
        lines.append("")

    lines.append("## Notes")
    lines.append("- Correlation is descriptive evidence, not causality.")
    lines.append("- Ablation/backtest described in TDD should be extended when more artifacts are available (e.g., per-model predictions, feature importance exports).")
    lines.append("")
    return "\n".join(lines)


def build_report(paths: KnowledgeReportPaths) -> dict:
    return build_knowledge_summary(
        dataset_csv=paths.dataset_csv,
        dataset_meta_json=paths.dataset_meta_json,
        vn30_history_clean_csv=paths.vn30_history_clean_csv,
        val_predictions_csv=paths.val_predictions_csv,
        max_rows_for_corr=None,
    )


def write_report(out_dir: Path, paths: KnowledgeReportPaths) -> dict:
    out_dir.mkdir(parents=True, exist_ok=True)
    report = build_report(paths)
    md = render_markdown(report)

    ts = dt.datetime.now().strftime("%Y%m%d_%H%M%S")
    json_path = out_dir / f"knowledge_{ts}.json"
    md_path = out_dir / f"knowledge_{ts}.md"
    json_path.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    md_path.write_text(md, encoding="utf-8")
    return {"json": str(json_path), "md": str(md_path), "asof": report.get("asof")}


