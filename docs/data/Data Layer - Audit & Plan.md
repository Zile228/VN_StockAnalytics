# Data Layer (Phần 1) — Audit & Plan

Tài liệu này kiểm tra **toàn bộ dữ liệu đang có trong `data/`** và các **script hiện tại đang tạo/đào dữ liệu** trong `src/`, nhằm:

- Chốt **data contracts** (schema + type + quy ước thời gian).
- Chỉ ra **điểm thiếu** / **rủi ro chất lượng dữ liệu**.
- Đưa ra **checklist việc cần làm** cho các phần tiếp theo trước khi triển khai sâu hơn.

> Nguyên tắc theo thiết kế dự án: **Data Mining trước, AI sau**, ưu tiên **minh bạch + giải thích được**.  
> “Knowledge/Reasoning” phải dựa trên **rule-based deterministic**, LLM chỉ **diễn giải**.

---

## 1) Inventory dữ liệu hiện có trong repo

### 1.1. `data/timeseries/`
- `vn30_history.csv`
- `macro.xlsx`
- `Dữ-liệu-Lịch-sử-USD_VND-1.csv`
- `bank.xlsx`
- `~$bank.xlsx` (**file tạm/lock của Excel** — không nên dùng làm dữ liệu)

### 1.2. `data/bronze/`
- `VN30_Merged_News.csv`

### 1.3. `data/silver/`
- `VN30_Sentiment_Analyzed.csv`

---

## 2) Data contracts (schema thực tế) + nhận xét chất lượng

### 2.1. Market OHLCV — `data/timeseries/vn30_history.csv`

**Header thực tế**
- `time, open, high, low, close, volume, symbol`

**Đơn vị bản ghi**
- 1 dòng = 1 ngày giao dịch của 1 mã (`symbol`) theo `time` (YYYY-MM-DD).

**Coverage nhanh (quan sát)**
- Có **30 symbols**.
- Mốc thời gian **không đồng nhất** theo từng mã: có mã từ ~2006, có mã từ ~2018 (khả năng do ngày niêm yết/nguồn dữ liệu).
- Không thấy duplicate theo (symbol, time) trong sample scan.

**Rủi ro / thiếu**
- Chưa có **trading calendar** chuẩn: không biết missing do nghỉ lễ hay do thiếu data.
- Chưa có **adjusted price** (chia tách, cổ tức…); hiện là giá “raw”.
- Có thể có các điểm dữ liệu “bất thường” (ví dụ `close=0` hiếm) → cần rule xử lý.

**DoD cho dataset này**
- [ ] Validate: không duplicate (symbol, date)
- [ ] Validate: `high>=max(open,close)`, `low<=min(open,close)`, volume >= 0
- [ ] Chuẩn hoá type: float cho OHLC, int/float cho volume
- [ ] Sinh `data/gold/` (hoặc tương đương) để cache features (returns/vol/ATR/…)

---

### 2.2. News Bronze — `data/bronze/VN30_Merged_News.csv`

**Header thực tế**
- `symbol, date_time, title, sapo, content_url, source`

**Nhận xét**
- Dataset hiện **rất nhỏ** (cỡ vài chục dòng) và chủ yếu là **recent 2–3 ngày**.
- Hiện chưa thấy trường hợp `symbol` chứa nhiều mã cùng lúc (ví dụ `"ACB, FPT"`), nhưng **crawler có logic trả về nhiều mã** → cần contract rõ.

**Rủi ro / thiếu**
- Nếu `symbol` có thể là list dạng chuỗi (comma-separated) → join với time series sẽ sai.
- `date_time` có nhiều format (`YYYY-MM-DD HH:MM` hoặc `YYYY-MM-DDTHH:MM:SS`).

**DoD**
- [ ] Quy định `symbol` phải là **1 ticker / 1 row** (nếu nhiều ticker → explode thành nhiều dòng).
- [ ] Chuẩn hoá `published_at` sang ISO `YYYY-MM-DDTHH:MM:SS` (timezone policy nếu cần).
- [ ] Dedupe key: ít nhất `(symbol, title, source, published_at)` hoặc `(url)` nếu có.

---

### 2.3. Sentiment Silver — `data/silver/VN30_Sentiment_Analyzed.csv`

**Header thực tế (rút gọn)**
- `symbol, date_time, title, sapo, content_url, source, date_dt, clean_time, full_text, sentiment_score, relevance, category, reasoning, model_used`

**Nhận xét**
- Số dòng hiện tương đương bronze (nhỏ, recent).
- `sentiment_score` đang ở dạng chuỗi số (ví dụ `"2"`) → cần parse về int/float.
- `relevance` dạng chuỗi số thực.

**DoD**
- [ ] Chuẩn hoá type: `sentiment_score: int`, `relevance: float`
- [ ] Chuẩn hoá timestamp: `published_at` ISO
- [ ] Join rule cho evidence: theo `(symbol, date)` hoặc `(symbol, published_at within lookback)`

---

### 2.4. Macro — `data/timeseries/macro.xlsx`

**Sheet**
- `Sheet1`

**Header thực tế**
- `Year, Quarter, INF, GDP, DC`

**Đặc thù**
- Các trường `%` là string dạng `"2,95%"` → cần parse sang float (0.0295).

**DoD**
- [ ] Parse % dạng VN locale (comma decimal + %)
- [ ] Quy định mapping từ quarterly → daily: forward-fill theo quý (có “lag” nếu muốn causal)

---

### 2.5. FX — `data/timeseries/Dữ-liệu-Lịch-sử-USD_VND-1.csv`

**Header thực tế**
- `Ngày, Lần cuối, Mở, Cao, Thấp, KL, % Thay đổi`

**Đặc thù**
- `Ngày` đang là `DD/MM/YYYY`
- Giá dạng `"26,357.0"` (comma separator)
- `% Thay đổi` dạng `"-0.06%"`

**DoD**
- [ ] Parse `DD/MM/YYYY` → `date`
- [ ] Parse numeric theo VN locale
- [ ] Chọn field chuẩn: ưu tiên `Lần cuối` làm “close”
- [ ] Quy định sort order (file thường newest-first)

---

### 2.6. Fundamental (Bank) — `data/timeseries/bank.xlsx`

**Sheets**
- `ratio`, `balance_sheet`, `income_statement`, `cash_flow`

**Header quan sát (sheet `ratio`)**
- Có cột `CP` (ticker), `Năm`, `Kỳ` và nhiều chỉ tiêu (ROE/ROA, P/E, P/B, EPS…).

**Nhận xét**
- Đây là dataset fundamental quan trọng nhưng hiện chưa có pipeline ingest + align với daily time axis.

**DoD**
- [ ] Chuẩn hoá schema chung cho fundamental: (symbol, period_end, metric_name, metric_value) hoặc wide-table có versioning
- [ ] Quy định mapping kỳ (quý/năm) → daily (forward-fill có kiểm soát)
- [ ] Validate ticker nằm trong VN30 (hoặc cho phép ngoài VN30 có flag)

---

## 3) Audit code “đào data” hiện tại (`src/`)

### 3.1. `src/news_crawler.py`
**Chức năng**
- Crawl CafeF + TCBS và lưu `data/bronze/VN30_Merged_News.csv`.

**Điểm cần lưu ý**
- Dùng `pandas` để sort + drop duplicates.
- Có logic “tìm ticker trong text”, có thể trả về nhiều ticker → rủi ro contract (cần explode).
- Chưa có “incremental ingestion” rõ ràng (cache theo ngày hoặc theo url).

**Thiếu cần bổ sung (Data Layer)**
- [ ] Contract: `symbol` single-ticker
- [ ] Dedupe policy rõ ràng
- [ ] Lưu thêm `published_at_iso` (chuẩn hoá datetime)
- [ ] Logging + retry/rate-limit policy rõ ràng (để chạy pipeline ổn định)

### 3.2. `src/preprocessing.py`
**Chức năng**
- Đọc news CSV, làm sạch text, tạo `full_text`.

**Thiếu**
- [ ] Cần tách “data contract transformation” (silver step) khỏi “pandas-only” nếu muốn tuân thủ constraint “stdlib+numpy ưu tiên”.

### 3.3. `src/news_sentiment.py`
**Chức năng**
- Gọi Groq/Gemini để sinh sentiment và append vào silver CSV.

**Thiếu**
- [ ] Data Layer cần mode “offline/no-key” (skip sentiment) hoặc rule-based sentiment placeholder.
- [ ] Chuẩn hoá type của output (score/relevance) và đảm bảo schema ổn định.

### 3.4. Thiếu hẳn ingestion scripts cho timeseries/macro/fundamental
Hiện repo **chưa có**:
- Script fetch/update `vn30_history.csv`
- Script ingest/clean cho `USDVND` (DD/MM/YYYY)
- Script ingest/normalize `bank.xlsx`
- `pipeline/` đang trống (chưa có jobs)

---

## 4) Những gì còn thiếu (Gap Analysis)

### 4.1. Data dictionary + versioning
- Chưa có tài liệu “data_dictionary.md” chính thức: field name, type, meaning, units.
- Chưa có versioning: `v1/v2` schema, hoặc “gold layer” có dấu vết tạo từ raw.

### 4.2. Data quality checks (bắt buộc trước Modeling/Knowledge)
- OHLCV sanity checks
- Missing day analysis + trading calendar
- Outlier detection (close=0, volume spikes)

### 4.3. Coverage tin tức/sentiment quá ngắn
Nếu mục tiêu có backtest/insight dài hạn:
- cần dữ liệu news dài hơn (hoặc mô tả giới hạn rõ trong báo cáo).

### 4.4. Đồng bộ đa tần suất (daily vs quarterly)
Macro + fundamental đều multi-frequency:
- cần policy align: forward-fill + lag để tránh leakage.

---

## 5) Checklist việc cần làm tiếp (sau khi chốt Data Layer)

### 5.1. Chuẩn hoá cấu trúc layer dữ liệu
Đề xuất:
- `data/bronze/`: raw crawl/ingest (news)
- `data/silver/`: cleaned + enriched (sentiment, normalized datetime)
- `data/gold/`: feature tables / joined datasets phục vụ model/knowledge

### 5.2. Viết “Data Dictionary” chính thức
- [x] `docs/data/data_dictionary.md`: mô tả field, type, unit, source, update frequency

### 5.3. Viết “Data Quality Report” (auto)
- [x] Script chạy CLI tạo report JSON/MD: counts, ranges, missing, anomalies  
  - Chạy: `python main.py data_quality --out_dir output`
  - Output: `output/data_quality_{timestamp}.json` và `output/data_quality_{timestamp}.md`

### 5.4. Implement ingestion pipeline (phase tiếp theo)
- [ ] `pipeline/ingest_timeseries.py` (hoặc module trong `src/data_access/ingest/`)
- [ ] `pipeline/ingest_macro_fx.py` (parse `macro.xlsx`, `USDVND csv`)
- [ ] `pipeline/ingest_fundamentals.py` (parse `bank.xlsx`)
- [ ] `pipeline/ingest_news.py` (bronze news)
- [ ] `pipeline/build_silver_news.py` (preprocess + sentiment, có offline mode)

### 5.5. Định nghĩa “Definition of Done” cho Data Layer
- [ ] Mỗi dataset có schema + type ổn định
- [ ] Có quality checks + report
- [ ] Có gold-layer outputs tái lập được từ bronze/silver
- [ ] Có log + CLI để chạy lại toàn bộ pipeline

---

## 6) Quyết định cần bạn xác nhận trước khi code tiếp
- **A)** Có muốn chính thức đưa `bank.xlsx` vào scope (fundamental features) ở phase gần nhất không?
- **B)** News/sentiment hiện rất ngắn: có cần mở rộng corpus (crawl nhiều ngày hơn / thêm nguồn) hay chấp nhận giới hạn để demo?
- **C)** Quy ước timezone và datetime chuẩn (UTC hay Asia/Ho_Chi_Minh)?


