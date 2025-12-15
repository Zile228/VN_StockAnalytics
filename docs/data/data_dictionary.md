# Data Dictionary — VN_StockAnalytics (Official)

Tài liệu này là **data contract chính thức** cho Data Layer của dự án VN_StockAnalytics.

Mục tiêu:
- Chuẩn hoá **schema / type / unit** cho từng dataset trong `data/`.
- Chuẩn hoá **datetime + timezone** (theo quyết định: **Asia/Ho_Chi_Minh**).
- Là tài liệu “handoff” để các bạn khác có thể mở rộng ingestion/crawl mà **không phá contract**.

---

## 0) Quy ước chung (Global Conventions)

### 0.1. Timezone & datetime
- **Canonical timezone**: `Asia/Ho_Chi_Minh` (UTC+07:00).
- **Canonical datetime string** (nếu dùng datetime): ISO 8601 có offset, ví dụ: `2025-12-10T16:33:00+07:00`.
- **Canonical date string** (nếu chỉ theo ngày): `YYYY-MM-DD`, ví dụ: `2025-12-10`.

**Policy parse/normalize**
- Input có thể đến từ nhiều format (ví dụ `YYYY-MM-DD HH:MM`, `YYYY-MM-DDTHH:MM:SS`, `DD/MM/YYYY`).
- Sau ingestion, mọi datetime được chuẩn hoá sang ISO 8601 + offset `+07:00` (nếu có giờ).

### 0.2. Symbol/ticker
- `symbol`: uppercase, không whitespace.
- **1 row = 1 symbol**. Nếu bài news có nhiều symbol → phải explode thành nhiều row (mỗi symbol 1 row).

### 0.3. Layering
- **Bronze**: raw ingest/crawl, giữ nguyên tối đa, chỉ thêm metadata tối thiểu.
- **Silver**: cleaned/normalized, đảm bảo schema ổn định, dedupe, type đúng.
- **Gold** (đề xuất): feature tables / joined tables phục vụ model + knowledge.

### 0.4. Numeric parsing (VN locale)
Một số file có số dạng `"26,357.0"` hoặc `"2,95%"`.
- Quy ước: parse về `float` (hoặc `int` nếu phù hợp).
- `%` parse về decimal (ví dụ `"2,95%"` → `0.0295`).

---

## 1) Market OHLCV (VN30) — `data/timeseries/vn30_history.csv`

### 1.1. Nguồn & tần suất
- **Source**: dataset lịch sử (đã có sẵn trong repo).
- **Update frequency**: daily (khi có pipeline ingest mới, dự kiến update theo ngày).

### 1.2. Schema
| Field | Type | Unit | Required | Notes |
| --- | --- | --- | --- | --- |
| `time` | `date` (string `YYYY-MM-DD`) | day | Yes | ngày giao dịch |
| `open` | `float` | price | Yes | |
| `high` | `float` | price | Yes | |
| `low` | `float` | price | Yes | |
| `close` | `float` | price | Yes | |
| `volume` | `float` | shares (proxy) | Yes | dùng làm liquidity proxy |
| `symbol` | `str` | ticker | Yes | uppercase |

### 1.3. Keys & constraints
- **Primary key**: (`symbol`, `time`)
- Constraints:
  - `high >= max(open, close)`
  - `low <= min(open, close)`
  - `volume >= 0`

---

## 2) News Bronze — `data/bronze/VN30_Merged_News.csv`

### 2.1. Nguồn & tần suất
- **Source**: crawler CafeF + TCBS (`src/news_crawler.py`).
- **Update frequency**: on-demand (CLI) / scheduled (future pipeline).

### 2.2. Schema (bronze)
| Field | Type | Unit | Required | Notes |
| --- | --- | --- | --- | --- |
| `symbol` | `str` | ticker | Yes | **1 symbol / row** (explode nếu cần) |
| `date_time` | `str` (raw) | datetime | Yes | input có thể nhiều format |
| `title` | `str` | text | Yes | |
| `sapo` | `str` | text | No | có thể rỗng |
| `content_url` | `str` | url | No | |
| `source` | `str` | enum-ish | Yes | ví dụ: `CafeF`, `TCBS` |

### 2.3. Dedupe (recommendation)
Bronze có thể giữ duplicates; silver sẽ dedupe. Tuy nhiên để giảm noise:
- **Prefer dedupe key**: `content_url` (nếu ổn định), fallback: (`symbol`, `title`, `source`, normalized_date`).

---

## 3) News Silver + Sentiment — `data/silver/VN30_Sentiment_Analyzed.csv`

### 3.1. Nguồn & tần suất
- **Source**: preprocess (`src/preprocessing.py`) + sentiment (`src/news_sentiment.py`).
- **Update frequency**: on-demand / scheduled.

### 3.2. Schema (silver)
| Field | Type | Unit | Required | Notes |
| --- | --- | --- | --- | --- |
| `symbol` | `str` | ticker | Yes | uppercase |
| `date_time` | `str` (raw) | datetime | Yes | raw input |
| `date_dt` | `str` (normalized datetime) | datetime | Yes | nên chuẩn hoá ISO+07:00 |
| `clean_time` | `str` | datetime (minute) | Yes | `YYYY-MM-DD HH:MM` (legacy) |
| `title` | `str` | text | Yes | |
| `sapo` | `str` | text | No | |
| `content_url` | `str` | url | No | |
| `source` | `str` | enum-ish | Yes | |
| `full_text` | `str` | text | Yes | cleaned text |
| `sentiment_score` | `int` | score | Yes | range mục tiêu: `[-5..5]` |
| `relevance` | `float` | score | Yes | range: `[0..1]` |
| `category` | `str` | label | No | |
| `reasoning` | `str` | text | No | max ~50 từ (policy) |
| `model_used` | `str` | id | No | |

### 3.3. Keys & constraints
- **Primary key (logical)**: (`symbol`, `clean_time`, `title`) hoặc (`content_url`) nếu unique.
- Constraints:
  - `sentiment_score` parse được thành int
  - `0.0 <= relevance <= 1.0`

---

## 4) Macro — `data/timeseries/macro.xlsx`

### 4.1. Nguồn & tần suất
- **Source**: file excel macro (đã có sẵn).
- **Update frequency**: quarterly.

### 4.2. Schema (Sheet1)
| Field | Type | Unit | Required | Notes |
| --- | --- | --- | --- | --- |
| `Year` | `int` | year | Yes | |
| `Quarter` | `int` | quarter | Yes | `1..4` |
| `INF` | `float` | decimal | No | input dạng `%` (`2,95%` → `0.0295`) |
| `GDP` | `float` | decimal | No | `%` |
| `DC` | `float` | decimal | No | `%` |

### 4.3. Align policy (macro → daily)
Khi join với daily market data:
- Default: forward-fill theo quý.
- **No-leakage option** (khuyến nghị cho modeling/backtest): apply lag (ví dụ +1 quý) hoặc dùng ngày công bố nếu có.

---

## 5) FX — `data/timeseries/Dữ-liệu-Lịch-sử-USD_VND-1.csv`

### 5.1. Nguồn & tần suất
- **Source**: export lịch sử tỷ giá (đã có sẵn).
- **Update frequency**: daily.

### 5.2. Schema (raw)
| Field (raw) | Type | Unit | Required | Notes |
| --- | --- | --- | --- | --- |
| `Ngày` | `str` | date | Yes | format `DD/MM/YYYY` |
| `Lần cuối` | `str` → `float` | price | Yes | numeric VN locale |
| `Mở` | `str` → `float` | price | No | |
| `Cao` | `str` → `float` | price | No | |
| `Thấp` | `str` → `float` | price | No | |
| `KL` | `str` | volume | No | thường rỗng |
| `% Thay đổi` | `str` → `float` | decimal | No | `-0.06%` → `-0.0006` |

### 5.3. Canonical (silver/gold đề xuất)
| Field | Type | Unit | Notes |
| --- | --- | --- | --- |
| `date` | `date` | day | `YYYY-MM-DD` |
| `close` | `float` | price | map từ `Lần cuối` |
| `pct_change` | `float` | decimal | map từ `% Thay đổi` |

**Gold output (đã implement)**
- `data/gold/usdvnd_daily.csv`
- Chạy: `python main.py ingest_fx`

---

## 6) Fundamental (Bank) — `data/timeseries/bank.xlsx` (IN SCOPE)

### 6.1. Nguồn & tần suất
- **Source**: file excel fundamental.
- **Update frequency**: quarterly.

### 6.2. Sheets
- `ratio`
- `balance_sheet`
- `income_statement`
- `cash_flow`

### 6.3. Contract đề xuất (canonical long-form)
Để dễ join/feature engineering, đề xuất convert về long-form (silver/gold):

| Field | Type | Unit | Required | Notes |
| --- | --- | --- | --- | --- |
| `symbol` | `str` | ticker | Yes | map từ `CP` |
| `year` | `int` | year | Yes | |
| `quarter` | `int` | quarter | Yes | map từ `Kỳ` |
| `statement` | `str` | enum | Yes | `ratio/balance_sheet/income_statement/cash_flow` |
| `metric` | `str` | name | Yes | tên chỉ tiêu (chuẩn hoá snake_case) |
| `value` | `float` | varies | Yes | |
| `unit` | `str` | unit | No | nếu xác định được (vd VND, %, ratio) |

**Gold output (đã implement)**
- `data/gold/fundamentals_long.csv`
- Chạy: `python main.py ingest_fundamentals`

---

## 9) Gold OHLCV (cleaned) — `data/gold/vn30_history_clean.csv`

**Source**
- Derived from `data/timeseries/vn30_history.csv` with minimal deterministic cleaning.

**Schema**
- Same as raw OHLCV: `time, open, high, low, close, volume, symbol`

**Cleaning policy (tóm tắt)**
- Drop row nếu `close <= 0`, thiếu numeric, volume < 0
- Fix tối thiểu:
  - Nếu `high < max(open, close)` → set `high = max(high, open, close)`
  - Nếu `low > min(open, close)` → set `low = min(low, open, close)`

**Chạy**
- `python main.py clean_ohlcv`

### 6.4. Align policy (fundamental → daily)
- Default: forward-fill theo quý cho các ngày thuộc quý đó (hoặc từ ngày công bố).
- No-leakage option: lag 1 kỳ khi backtest nếu không có ngày công bố.

---

## 7) File không thuộc dataset (phải ignore)
- `data/timeseries/~$bank.xlsx`: file lock/temp của Excel → **không ingest**.
- `.DS_Store`: ignore.

---

## 8) Handoff spec cho task “mở rộng news/sentiment corpus” (giao việc)

Team phụ trách mở rộng dữ liệu news/sentiment cần đảm bảo:

### 8.1. Output contract (bronze)
File: `data/bronze/VN30_Merged_News.csv`
- Mỗi row đúng schema bronze ở mục **2.2**
- `symbol` **single ticker**
- `date_time` parse được về datetime
- Dedupe ưu tiên theo `content_url` (nếu có)

### 8.2. Output contract (silver)
File: `data/silver/VN30_Sentiment_Analyzed.csv`
- Giữ schema ở mục **3.2**
- `sentiment_score` phải là **int**, `relevance` là **float**
- Normalize `date_dt` về ISO 8601 + `+07:00`
- Mỗi row đúng 1 `symbol`

### 8.3. Đề xuất mở rộng corpus (không bắt buộc implement ngay)
- Tăng `DAYS_BACK_VNSTOCK` và số page CafeF
- Thêm nguồn khác (nếu có) nhưng phải map về cùng schema bronze
- Cơ chế incremental: lưu checkpoint theo `content_url` hoặc hash (`source+url+published_at`)


