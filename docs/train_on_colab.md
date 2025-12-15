## Train model trên Google Colab (workflow đề xuất)

Mục tiêu: bạn train model trên Colab, còn repo local chỉ đảm nhiệm **feature engineering deterministic** và xuất dataset “no-leakage ready”.

### 1) Chuẩn bị dữ liệu gold (local)

Chạy các bước Data Layer (nếu chưa chạy):

```bash
python main.py clean_ohlcv
python main.py ingest_fx
python main.py ingest_fundamentals
```

### 2) Build dataset cho training (local)

```bash
python main.py build_dataset --out_path data/gold/model_dataset_h7.csv --horizon 7 --fund_lag_quarters 1 --macro_lag_quarters 1 --sentiment_lookback_days 7
```

Output:
- `data/gold/model_dataset_h7.csv`
- `data/gold/model_dataset_h7.csv.meta.json` (metadata: spec, columns, date_range, rows)

### 3) Upload lên Colab

Upload 2 file:
- `model_dataset_h7.csv`
- `model_dataset_h7.csv.meta.json` (optional nhưng nên có)

### 4) Template train nhanh trên Colab (gợi ý)

Trong Colab bạn có thể dùng pandas/sklearn/torch tùy model. Ví dụ baseline regression:

```python
import pandas as pd
import numpy as np

df = pd.read_csv("model_dataset_h7.csv")

# Target
y = df["y_future_return"].astype(float).values

# Feature columns (bỏ symbol/date)
drop_cols = {"date","symbol","y_future_return"}
X = df[[c for c in df.columns if c not in drop_cols]].apply(pd.to_numeric, errors="coerce").fillna(0.0).values

# Time-based split (khuyến nghị): train <= 2023-12-31, val/test sau đó
df["date"] = pd.to_datetime(df["date"])
train_mask = df["date"] <= "2023-12-31"
X_train, y_train = X[train_mask.values], y[train_mask.values]
X_val, y_val = X[~train_mask.values], y[~train_mask.values]

from sklearn.linear_model import Ridge
model = Ridge(alpha=1.0)
model.fit(X_train, y_train)
pred = model.predict(X_val)

rmse = np.sqrt(np.mean((pred - y_val)**2))
print("RMSE:", rmse)
```

### 5) No-leakage controls

- `--fund_lag_quarters`: lag fundamentals theo quý (khuyến nghị `1` khi backtest).
- `--macro_lag_quarters`: lag macro theo quý (khuyến nghị `1`).
- Target `y_future_return` được tạo bằng **shift theo trading days** trong từng `symbol`.

### 6) Bước tiếp theo (khi có model thật)

Khi bạn train xong trên Colab:
- Export artifact (weights/metrics) và đưa về repo (hoặc storage) theo format thống nhất.
- Tạo “forecast bundle” output để thay thế stub trong orchestrator.


