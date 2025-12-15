# TECH STACK DESIGN DOCUMENT

## VN STOCK ANALYTICS – DATA MINING PROJECT

* * *

## 1. Nguyên tắc lựa chọn tech stack

Tech stack của dự án được lựa chọn dựa trên 5 nguyên tắc cốt lõi:

1. **Phục vụ Data Mining trước, AI sau**  
    → Ưu tiên pipeline dữ liệu, feature, insight hơn inference real-time.
    
2. **Minh bạch & dễ giải thích**  
    → Tránh công nghệ “black-box” khó trình bày trong đồ án.
    
3. **Phù hợp sinh viên – triển khai được trong phạm vi đồ án**  
    → Không yêu cầu hạ tầng enterprise phức tạp.
    
4. **Có thể mở rộng thành sản phẩm demo**  
    → Có frontend, backend, dashboard rõ ràng.
    
5. **Phân tách rõ vai trò các layer**  
    → Dữ liệu – mô hình – tri thức – giao diện.
    

* * *

## 2. Tổng quan tech stack theo kiến trúc hệ thống

Hệ thống sử dụng **kiến trúc nhiều tầng**, tương ứng với từng nhóm công nghệ:

| Layer | Mục tiêu | Tech chính |
| --- | --- | --- |
| Data Collection | Thu thập dữ liệu | Python |
| Data Storage | Lưu trữ & quản lý | File-based + DB |
| Feature Engineering | Biến đổi dữ liệu | Python |
| Modeling | Data Mining & AI | ML / DL frameworks |
| Knowledge & Reasoning | Trích xuất tri thức | Rule-based + LLM |
| Backend API | Kết nối hệ thống | Python API |
| Frontend | Trực quan hóa | Web frontend |
| Visualization | Insight & dashboard | Charting libraries |

* * *

## 3. Data Collection & Preprocessing Stack

### 3.1. Ngôn ngữ chính: **Python**

**Lý do lựa chọn**

* Chuẩn thực tế trong Data Mining & ML
    
* Hệ sinh thái thư viện phong phú
    
* Dễ trình bày trong đồ án học thuật
    

**Vai trò**

* Thu thập dữ liệu giá, tài chính, macro
    
* Crawl & xử lý tin tức
    
* Tiền xử lý dữ liệu thô
    

* * *

### 3.2. Thu thập dữ liệu

| Loại dữ liệu | Công nghệ |
| --- | --- |
| Giá cổ phiếu | API / CSV |
| Báo cáo tài chính | CSV / Excel |
| Macro | CSV |
| Tin tức | Web scraping / API |

📌 Lưu ý đồ án:

> Cần mô tả rõ **nguồn dữ liệu** và **độ tin cậy**, không cần real-time.

* * *

## 4. Data Storage & Management

### 4.1. Lưu trữ dữ liệu thô & trung gian

**File-based storage**

* CSV (time series, feature table)
    
* JSON (metadata, sentiment output)
    

**Lý do**

* Minh bạch
    
* Dễ kiểm tra
    
* Phù hợp đồ án Data Mining
    

* * *

### 4.2. Database (Optional nhưng khuyến khích)

**PostgreSQL / SQLite**

**Vai trò**

* Lưu metadata
    
* Lưu kết quả backtest
    
* Lưu cấu hình mô hình & experiment
    

📌 Không bắt buộc dùng Big Data stack (Spark, Hadoop).

* * *

## 5. Feature Engineering & Data Mining Stack

### 5.1. Xử lý dữ liệu & feature

**Python scientific stack**

* NumPy
    
* SciPy
    

**Vai trò**

* Tính technical indicators
    
* Chuẩn hóa dữ liệu
    
* Tạo lagged & rolling features
    

📌 Quan trọng với đồ án:

> Feature engineering phải được mô tả rõ trong báo cáo, không cần tối ưu tốc độ.

* * *

### 5.2. Text Mining & Sentiment Analysis

**NLP Stack**

* Pretrained language model (PhoBERT)
    
* Custom sentiment scoring
    

**Vai trò**

* Biến văn bản → sentiment score
    
* Gán mức độ ảnh hưởng cho từng mã cổ phiếu
    

📌 Sentiment là **feature**, không phải kết quả cuối.

* * *

## 6. Modeling & AI Stack

### 6.1. Machine Learning (Tabular)

**XGBoost**

* Khai phá quan hệ phi tuyến
    
* Feature importance rõ ràng
    

**Vai trò học thuật**

* Giải thích tác động của từng nhóm feature
    
* Phục vụ Data Mining insight
    

* * *

### 6.2. Deep Learning (Time Series)

**BiLSTM**

* Học pattern theo chuỗi thời gian
    

**Temporal Fusion Transformer (TFT)**

* Khai phá quan hệ động
    
* Attention để diễn giải
    

📌 Không bắt buộc dùng cả hai trong demo,  
nhưng **tài liệu nên mô tả để thể hiện chiều sâu học thuật**.

* * *

## 7. Evaluation & Backtesting Stack

### 7.1. Đánh giá mô hình

**Metric layer**

* MAE, RMSE
    
* Directional accuracy
    

**Vai trò**

* So sánh mô hình
    
* Không phải mục tiêu cuối
    

* * *

### 7.2. Backtesting

**Custom backtest engine (Python)**

**Vai trò**

* Kiểm chứng tri thức Data Mining
    
* So sánh chiến lược có/không có feature
    

📌 Backtest = công cụ xác thực insight, không phải trading engine.

* * *

## 8. Knowledge & Reasoning Stack

### 8.1. Rule-based Reasoning

**Rule Engine (logic thuần)**

* If–then rules
    
* Condition-based explanation
    

**Vai trò**

* Chuyển output mô hình → tri thức
    

* * *

### 8.2. LLM (Explainability Layer)

**LLM API (OpenAI / open-source)**

**Vai trò**

* Diễn giải insight
    
* Viết explanation cho tín hiệu
    
* Tóm tắt kết quả phân tích
    

📌 LLM **không được phép** quyết định mua/bán.

* * *

## 9. Backend API Stack

### 9.1. Backend framework

**FastAPI / Flask**

**Vai trò**

* Kết nối frontend với pipeline
    
* Serve kết quả phân tích
    
* Quản lý request theo module
    

📌 Ưu tiên FastAPI vì:

* Nhẹ
    
* Rõ schema
    
* Dễ demo
    

* * *

## 10. Frontend & Visualization Stack

### 10.1. Frontend framework

**Web-based UI**

* HTML / CSS / JavaScript
    
* Hoặc React (nếu team quen)
    

**Vai trò**

* Hiển thị dashboard
    
* Biểu đồ giá & tín hiệu
    
* Portfolio & backtest result
    

* * *

### 10.2. Visualization

**Charting libraries**

* Plotly
    
* Chart.js
    
* D3.js (optional)
    

📌 Visualization là **bằng chứng trực quan của Data Mining**, không phải trang trí.

* * *

## 11. Dev & Experiment Management (Khuyến khích)

### 11.1. Version control

* Git
    
* GitHub / GitLab
    

### 11.2. Experiment tracking (Optional)

* File log
    
* MLflow (nếu có thời gian)
    

* * *

## 12. Tóm tắt tech stack theo vai trò đồ án

| Mục tiêu đồ án | Công nghệ |
| --- | --- |
| Khai phá dữ liệu | Python |
| Time series mining | BiLSTM / TFT |
| Feature impact | XGBoost |
| Text mining | PhoBERT |
| Tri thức & insight | Rule-based + LLM |
| Chứng minh hiệu quả | Backtest |
| Trình diễn | Web dashboard |
