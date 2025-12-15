# CHANGELOG / DEVELOPMENT STATUS (AHT_13)

## Snapshot (2025-12-15)

### Implemented (demo-ready)

- **Deterministic recommendation pipeline (LLM optional)**: `src/llm_orchestrator/`, `src/rulebase/`, `src/optimizer/`, `src/data_access/`
- **Data layer gold-first + quality tooling**:
  - `main.py` commands: `data_quality`, `clean_ohlcv`, `ingest_fundamentals`, `ingest_fx`, `build_dataset`, `recommend`
  - Gold outputs: `data/gold/vn30_history_clean.csv`, `data/gold/fundamentals_long.csv`, `data/gold/usdvnd_daily.csv`
- **Forecast bundle integration (artifacts)**: `models/artifacts_h7/` + `src/modeling/forecast_bundle.py`
- **Backend API (FastAPI)**: `app/main.py`
  - **Explorer endpoints**: `/api/stocks`, `/api/stocks/{symbol}/history|latest|features|news|prediction`
  - **Recommendation endpoint**: `/api/recommend`
  - **Dashboard/Portfolio/Backtest endpoints**:
    - `/api/dashboard/overview` (VN30 equal-weight proxy index)
    - `/api/portfolio/optimize` (seeded Monte Carlo)
    - `/api/backtest/run` (deterministic rebalance backtest)
- **Frontend web integration**: `web/`
  - Vite proxy `/api` → backend
  - **Stock Explorer**: backend mode + candlestick/zoom + volume + OHLC tooltip
  - **Signals**: backend mode via `/api/recommend`
  - **Dashboard / Portfolio / Backtest**: backend mode via new endpoints

### Deferred / Pending (nice-to-have / future work)

- **Advisory backend**: currently UI uses in-browser mock logic (`web/src/components/advisory/AdvisoryPanel.tsx` + `web/src/services/advisoryService.ts`)
- **Simulation backend**: currently UI uses in-browser mock logic (`web/src/components/simulation/SimulationPanel.tsx`)
- **Knowledge layer “explainability” outputs**:
  - Feature-importance/attention narratives and “pattern mining” summaries described in TDD phần 7 chưa được expose thành API/visuals
- **News/sentiment corpus expansion**: doc handoff spec exists; ingestion expansion is separate task

---

# Prompt 1 (development history)

Bạn là senior Python engineer + ML engineer. Mục tiêu: triển khai module “LLM Orchestrator” để tạo khuyến nghị đặt lệnh (buy/sell/hold), kế hoạch vào lệnh (limit/ladder), quản trị rủi ro (SL/TP theo ATR/vol), và phân bổ danh mục (deterministic optimizer), dựa trên dữ liệu sẵn có trong repo VN_STOCKANALYTICS.

Bối cảnh repo hiện tại (đã có):
- data/
  - bronze/VN30_Merged_News.csv
  - silver/VN30_Sentiment_Analyzed.csv
  - timeseries/vn30_history.csv
  - timeseries/macro.xlsx
  - timeseries/Dữ-liệu-Lịch-sử-USD_VND-1.csv
- src/
  - check_models.py
  - news_crawler.py
  - news_sentiment.py
  - preprocessing.py
- web/ (đang có)
- config.py, main.py, requirements.txt

Yêu cầu quan trọng:
1) Không tự ý dùng pandas trừ khi thật sự cần. Ưu tiên stdlib (csv, json, datetime) + numpy. Nếu cần đọc xlsx thì dùng openpyxl.
2) Phần phân bổ (allocation) và gating phải deterministic (code), LLM chỉ “diễn giải + đóng gói” trade plan.
3) Output phải theo schema JSON cố định để UI render.
4) Code phải sạch, tách module rõ, có type hints, docstrings, và chạy được từ CLI.
5) Không giả định có database hay dịch vụ bên ngoài. Ở giai đoạn này: API layer mock bằng cách đọc file trong data/ và tính toán nội bộ.

Deliverable cần tạo:
A) Các module mới trong src/:
- src/llm_orchestrator/
  - orchestrator.py        (pipeline: load -> gating -> optimize -> llm -> output)
  - tools.py               (định nghĩa “tool interface” và implementation đọc data local)
  - prompts.py             (system + decision prompt templates)
  - schema.py              (Pydantic models hoặc dataclasses để validate output JSON)
- src/rulebase/
  - gating.py              (lọc mã theo liquidity/quality/uncertainty)
  - execution_rules.py     (rule limit/ladder/SL/TP theo ATR/vol)
- src/optimizer/
  - allocation.py          (mean-variance đơn giản hoặc risk-parity; có ràng buộc)
- src/data_access/
  - loaders.py             (load csv/xlsx -> cấu trúc python objects)
  - features.py            (tính returns, realized vol, ATR, spread proxy nếu có)
  - news.py                (join sentiment/news nếu cần cho evidence)

B) Cập nhật main.py để chạy CLI:
- python main.py recommend --user_id demo --horizon 7 --top_n 5
In ra JSON khuyến nghị (stdout) và lưu file output/recommendation_{timestamp}.json

C) Cập nhật config.py:
- Load env (OPENAI_API_KEY hoặc provider key) qua os.environ
- Cho phép chạy “LLM disabled mode” (nếu không có key) => vẫn xuất plan nhưng phần rationale là template rule-based.

D) requirements.txt:
- Chỉ bổ sung thư viện nếu thật cần (openpyxl, numpy, pydantic hoặc dataclasses-json). Tránh bloat.

Data contracts nội bộ (mock API):
1) Portfolio (mock):
- Tạo file src/data_access/mock_portfolio.py hoặc hardcode trong tools.py:
  cash: float
  positions: [{symbol, qty, avg_cost}]
  constraints: {max_weight_per_stock, min_cash_weight, max_positions}
  risk_profile: conservative|moderate|aggressive

2) Forecast bundle:
- Hiện repo chưa có model server => tạo module stub:
  - expected_return: dựa trên momentum đơn giản (ví dụ return_5d) + sentiment score (từ silver) để demo.
  - uncertainty: proxy bằng realized_vol_20d
  - model_quality: giả lập bằng 0.6–0.8 hoặc derive từ rolling error nếu có.
(Thiết kế sao cho sau này thay bằng output thật từ BiLSTM/TFT dễ dàng)

3) Microstructure:
- Proxy: liquidity = avg_volume_20d (từ vn30_history nếu có volume)
- spread/slippage: nếu không có orderbook thì dùng proxy: 1/liquidity hoặc volatility-based.

Trade-plan schema output (bắt buộc):
- horizon_days: int
- recommended_actions: list[{
    symbol: str,
    action: "buy"|"sell"|"hold",
    target_weight: float,
    confidence: float (0..1),
    expected_return: float,
    uncertainty_band: {p10,p50,p90},
    order_plan: {
      order_type: "limit"|"market"|"stop_limit",
      entry_rule: str,
      ladder: [{step_pct, size_pct_of_symbol}] (optional),
      time_in_force: "day"|"gtc"
    },
    risk_controls: {
      stop_loss_rule: str,
      take_profit_rule: str,
      max_loss_pct_portfolio: float
    },
    evidence: list[str],
    invalidation: list[str]
  }]
- cash_weight: float
- notes: str

Rulebase bắt buộc:
- Gating:
  - loại nếu liquidity dưới ngưỡng hoặc uncertainty quá lớn so với expected_return
  - loại nếu model_quality dưới ngưỡng (stub)
- Execution:
  - mặc định limit; nếu slippage/spread proxy cao => limit + ladder 3 bước
  - SL/TP theo ATR/vol: Stop = entry - k_SL*ATR; TP = entry + k_TP*ATR
  - k theo risk_profile:
    conservative: k_SL=1.0, k_TP=1.5
    moderate: k_SL=1.2, k_TP=2.0
    aggressive: k_SL=1.5, k_TP=2.5
- Risk budget:
  - max_loss_pct_portfolio theo profile: 0.5%, 1.0%, 1.5%

Optimizer deterministic:
- Input: candidates {symbol, expected_return, risk}
- Output: weights + cash_weight thỏa constraints
- Ưu tiên implement risk-parity đơn giản hoặc mean-variance with constraints clamp:
  - chọn top_n theo score = expected_return / risk
  - phân bổ weight theo normalized score, clamp max_weight_per_stock, đảm bảo min_cash_weight
  - nếu thiếu -> phân bổ về cash

LLM Orchestrator:
- Nếu có API key: gọi LLM để viết rationale + entry_rule text + invalidation text dựa trên dữ liệu đã compute.
- LLM không được tự bịa số; chỉ được diễn giải từ input fields. Enforce bằng cách: cung cấp “facts payload” và yêu cầu trích dẫn evidence strings.
- Nếu không có key: rationale = rule-based template.

Yêu cầu code quality:
- Có typing đầy đủ.
- Có validate schema output trước khi lưu.
- Có log rõ (print hoặc logging).
- Không được viết code dở dang/truncated; tạo file hoàn chỉnh.

Hãy thực hiện:
1) Khảo sát repo và quyết định vị trí đặt module như trên (tạo folder nếu chưa có).
2) Implement loaders cho các file trong data/:
   - vn30_history.csv: parse date, OHLCV (nếu có), symbol.
   - VN30_Sentiment_Analyzed.csv: map sentiment theo date và symbol (nếu có).
   - macro.xlsx + USDVND csv: load để làm evidence (optional).
3) Implement feature calc: returns, realized vol, ATR.
4) Implement gating + optimizer + execution rules.
5) Implement orchestrator chạy end-to-end và CLI command trong main.py.
6) Viết README snippet trong README.md: cách chạy lệnh và mô tả output JSON.

Chỉ output code thay đổi và file mới tạo (kèm nội dung đầy đủ từng file). Không giải thích dài dòng.


## Cách chạy (CLI)

### Khuyến nghị đặt lệnh (deterministic core, LLM optional)

```bash
python main.py recommend --user_id demo --horizon 7 --top_n 5
```

- In **JSON** ra stdout (để UI render)
- Đồng thời lưu file vào `output/recommendation_{timestamp}.json`

### Output JSON schema (tóm tắt)

- `horizon_days`: int
- `recommended_actions`: list[{
  - `symbol`: str
  - `action`: `"buy"|"sell"|"hold"`
  - `target_weight`: float
  - `confidence`: float (0..1)
  - `expected_return`: float
  - `uncertainty_band`: `{p10,p50,p90}`
  - `order_plan`: `{order_type, entry_rule, ladder?, time_in_force}`
  - `risk_controls`: `{stop_loss_rule, take_profit_rule, max_loss_pct_portfolio}`
  - `evidence`: list[str]
  - `invalidation`: list[str]
}]
- `cash_weight`: float
- `notes`: str

## Kiến trúc module mới

- `src/data_access/`: loaders + feature calc (returns/vol/ATR) + evidence (news/sentiment)
- `src/rulebase/`: gating + execution rules (limit/ladder + SL/TP theo ATR/vol)
- `src/optimizer/`: deterministic allocation optimizer (score-based + constraints)
- `src/llm_orchestrator/`: pipeline orchestration + schema validation