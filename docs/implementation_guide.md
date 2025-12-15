# Implementation Guide — VN_StockAnalytics (Built Modules)

Tài liệu này mô tả **chi tiết những phần đã triển khai** trong repo `VN_StockAnalytics`, theo đúng tinh thần đồ án **Data Mining**: minh bạch dữ liệu, pipeline rõ ràng, tri thức & giải thích quyết định (Knowledge Layer).

---

## 1) Mục tiêu hệ thống (Data Mining–first)

Hệ thống hướng tới 3 giá trị chính:
- **(A) Dữ liệu & feature minh bạch**: có data contracts, cleaning/normalization, kiểm soát quality.
- **(B) Mô hình & forecast bundle**: có pipeline tạo dataset, tích hợp artifacts để demo (không cần model server).
- **(C) Tri thức & giải thích**: không chỉ “predict”, mà tạo **insights/patterns** và giải thích được các quyết định (gating, risk, allocation).

Nguyên tắc quan trọng:
- **Deterministic core**: gating / allocation / execution / knowledge analytics đều chạy bằng code (không LLM).
- **LLM optional**: nếu bật thì chỉ viết *narrative* dựa trên facts (hiện default đang disabled).
- **Không dùng database**: mọi thứ chạy file-based, đọc từ `data/` và artifacts cục bộ.

---

## 2) Cấu trúc repo và các layer đã build

### 2.1. Data Layer (file-based)

Thư mục dữ liệu:
- `data/bronze/`: raw ingest (news)
- `data/silver/`: normalized sentiment
- `data/timeseries/`: raw time series (OHLCV, macro, FX, bank.xlsx)
- `data/gold/`: canonical/cleaned/joined datasets phục vụ model + knowledge

Tài liệu contract:
- `docs/data/data_dictionary.md` (**official**) — schema, type, unit, keys, frequency, timezone `Asia/Ho_Chi_Minh`.

Các module Python tương ứng:
- `src/data_access/loaders.py`: loaders CSV/XLSX → Python objects.
- `src/data_access/features.py`: returns/vol/ATR + microstructure proxies.
- `src/data_access/news.py`: aggregate sentiment + pick evidence.
- `src/data_access/quality_report.py`: scan & report data quality (counts, missing, anomalies).
- `src/data_access/ohlcv_clean.py`: clean OHLCV anomalies → gold.
- `src/data_access/fundamentals.py`: normalize `bank.xlsx` → `data/gold/fundamentals_long.csv`.
- `src/data_access/fx.py`: normalize USDVND → `data/gold/usdvnd_daily.csv`.
- `src/data_access/fundamental_features.py`: snapshot fundamentals theo lag quarters + fundamentals boost.

### 2.2. Modeling Layer (dataset + artifacts integration)

Mục tiêu: hỗ trợ demo forecast mà **không cần inference server**.

- Dataset builder:
  - `src/modeling/dataset_builder.py`
  - Output: `data/gold/model_dataset_h{h}.csv` + `.meta.json`
  - Target: `y_future_return` (shift theo trading days per symbol, tránh leakage).

- Forecast bundle (artifact bridge):
  - `models/artifacts_h7/val_predictions.csv` (date,symbol,y_true,y_pred)
  - `src/modeling/forecast_bundle.py` (rolling RMSE → `uncertainty_sigma`, map RMSE → `model_quality`)

### 2.3. Orchestrator Layer (Decision Support: buy/sell/hold + plan + allocation)

Mục tiêu: pipeline end-to-end tạo JSON output cố định cho UI.

Modules:
- `src/llm_orchestrator/orchestrator.py`: end-to-end recommend pipeline.
- `src/llm_orchestrator/tools.py`: DataTools interface + LocalFileTools (read local files).
- `src/llm_orchestrator/schema.py`: Pydantic output schema (UI contract).
- `src/llm_orchestrator/prompts.py`: prompt templates (LLM optional).

Deterministic rulebase/optimizer:
- `src/rulebase/gating.py`: lọc theo liquidity/quality/signal-to-noise.
- `src/rulebase/execution_rules.py`: entry plan limit/ladder + SL/TP theo ATR + risk_profile.
- `src/optimizer/allocation.py`: allocation deterministic theo score + constraints (top-N, clamp, min cash).

Mock portfolio (deterministic):
- `src/data_access/mock_portfolio.py`

### 2.4. Knowledge Layer (Tri thức & giải thích — trọng tâm Data Mining)

Mục tiêu: tạo **bằng chứng học thuật**: “hệ thống học được gì từ dữ liệu?”, “tri thức có hữu ích không?”.

Modules:
- `src/knowledge/insights.py`: analytics deterministic:
  - market regime từ VN30 equal-weight proxy
  - feature impact evidence: corr(feature, y_future_return) theo group
  - sentiment bins + coverage report
  - robustness: corr(vol, |error|/rmse/model_quality) join dataset + predictions
  - selection lift validation (top-k theo y_pred vs baseline)
- `src/knowledge/report.py`: build JSON report + render Markdown.

Outputs:
- `output/knowledge_*.json`
- `output/knowledge_*.md`

---

## 3) CLI đã build (Python)

CLI entry: `main.py`

### 3.1. Recommend (trade plan JSON)

```bash
python3 main.py recommend --user_id demo --horizon 7 --top_n 5 --forecast_source artifacts
```

Kết quả:
- In JSON stdout
- Lưu file: `output/recommendation_{timestamp}.json`

### 3.2. Data Quality Report

```bash
python3 main.py data_quality --out_dir output
```

Sinh:
- `output/data_quality_*.json`
- `output/data_quality_*.md`

### 3.3. Gold ingestion

```bash
python3 main.py clean_ohlcv
python3 main.py ingest_fundamentals
python3 main.py ingest_fx
```

### 3.4. Build model dataset

```bash
python3 main.py build_dataset --out_path data/gold/model_dataset_h7.csv --horizon 7
```

### 3.5. Knowledge Report (tri thức)

```bash
python3 main.py knowledge_report --out_dir output
```

---

## 4) Backend API (FastAPI) đã build

Entry: `app/main.py`

### 4.1. Explorer endpoints (Stock Explorer)
- `GET /api/stocks`
- `GET /api/stocks/{symbol}/history?start=&end=&limit=`
- `GET /api/stocks/{symbol}/latest`
- `GET /api/stocks/{symbol}/features`
- `GET /api/stocks/{symbol}/news`
- `GET /api/stocks/{symbol}/prediction?horizon=&forecast_source=`

### 4.2. Recommendation endpoint
- `GET /api/recommend?user_id=&horizon=&top_n=&fund_lag_quarters=&forecast_source=`

### 4.3. Portfolio & Backtest endpoints (demo deterministic)
- `GET /api/dashboard/overview?limit=`
- `POST /api/portfolio/optimize`
  - body: `{symbols, lookback_days, n_portfolios, seed}`
- `POST /api/backtest/run`
  - body: `{symbols, weights, start?, end?, initial_capital, rebalance_period}`

### 4.4. Knowledge endpoints
- `GET /api/knowledge/summary`
- `GET /api/knowledge/symbol/{symbol}?horizon=&rmse_window=`

---

## 5) Frontend Web (React) đã build

Thư mục: `web/`

### 5.1. Data fetching pattern
- `web/src/services/apiClient.ts`: `apiGetJson` / `apiPostJson`
- Zod validation (contracts):
  - `web/src/types/recommendation.ts`
  - `web/src/types/stocks.ts`
  - `web/src/types/dashboard.ts`
  - `web/src/types/portfolio_api.ts`
  - `web/src/types/backtest_api.ts`
  - `web/src/types/knowledge.ts`

### 5.2. Tabs/pages
- Dashboard: `web/src/components/dashboard/MarketOverview.tsx` (Mock vs Backend)
- Stock Explorer: `web/src/components/explorer/StockExplorer.tsx` (Mock vs Backend)
  - Candlestick, zoom Brush, volume/liquidity bars, tooltip OHLC
- Portfolio Builder: `web/src/components/portfolio/PortfolioBuilder.tsx` (Mock vs Backend)
- Backtest: `web/src/components/backtest/BacktestPanel.tsx` (Mock vs Backend)
- Signals: `web/src/components/signals/SignalPanel.tsx` (Mock vs Backend qua `/api/recommend`)
- Knowledge: `web/src/components/knowledge/KnowledgePanel.tsx` (backend only)

Navigation:
- `web/src/components/layout/TabNavigation.tsx`
- `web/src/pages/Index.tsx`

---

## 6) Những “giới hạn” hiện tại 

Các điểm cần nêu rõ trong report:
- **Sentiment coverage trong gold dataset đang ~0** (nhiều row `sent_7d` trống) → limitation dữ liệu; cần mở rộng corpus hoặc chuẩn hoá join.
- **Ablation study theo đúng TDD 6.4** chưa đầy đủ (hiện có selection-lift & correlation evidence). Có thể bổ sung train baseline theo nhóm feature để chứng minh “giá trị từng nhóm dữ liệu”.
- **Feature importance / attention weights** (XGBoost/TFT) chưa xuất ra artifacts để dùng làm bằng chứng trực tiếp.

---

## 7) Checklist để “đóng” đồ án Data Mining (gợi ý)

- **Data contracts + data quality + cleaning**: DONE
- **Feature engineering + dataset + no-leakage**: DONE
- **Forecast bundle integration + uncertainty/quality**: DONE
- **Decision support pipeline (recommendation JSON)**: DONE
- **Knowledge layer (insight + validation)**: DONE (v1)
- **Ablation (with/without sentiment/macro/fund) + report**: TODO (khuyến nghị làm tiếp để ăn điểm học thuật)


