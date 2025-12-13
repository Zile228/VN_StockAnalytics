# 📈 VN30 Stock Sentiment & Prediction Engine

Hệ thống thu thập dữ liệu, phân tích cảm xúc (Sentiment Analysis) và dự báo xu hướng cổ phiếu VN30 sử dụng sức mạnh của Large Language Models (LLMs) như Llama 3 và Gemini.

## 🚀 Giới thiệu
Dự án nhằm giải quyết bài toán định lượng tin tức tài chính tại thị trường chứng khoán Việt Nam. Thay vì chỉ dựa vào phân tích kỹ thuật (Technical Analysis), hệ thống này còn kết hợp và lượng hóa các tin tức, tin đồn và báo cáo tài chính.

## 🛠 Kiến trúc Hệ thống
Hệ thống hoạt động theo mô hình Data Pipeline 3 tầng:

1.  **Bronze Layer (Data Collection):**
    *   Crawler đa luồng thu thập dữ liệu thô.
    *   Xử lý bất đồng bộ, tự động loại bỏ tin rác/trùng lặp.
2.  **Silver Layer (NLP & Enrichment):**
    *   Tiền xử lý dữ liệu cơ bản, đảm bảo dữ liệu sạch để thực hiện các bước xử lý sau
    *   Cơ chế **Atomic Write**: Lưu dữ liệu realtime, đảm bảo không mất dữ liệu khi ngắt kết nối.
3.  **Gold Layer (Feature Engineering):**
    *   Tính toán các chỉ số chuỗi thời gian.
    *   Chuẩn hóa dữ liệu đầu vào cho các mô hình Machine Learning dự báo giá.

## 📂 Cấu trúc Dự án
```bash
VN30-STOCK-PREDICTION/
├── .env                  # Chứa API Key (Không commit file này)
├── .gitignore            # Cấu hình Git ignore
├── requirements.txt      # Các thư viện phụ thuộc
├── main.py               # Entry point chạy toàn bộ pipeline
├── config.py             # Quản lý cấu hình hệ thống
├── data/
│   ├── bronze/              # Dữ liệu thô sau khi crawl (Bronze)
│   ├── silver/              # Dữ liệu đã tiền xử lý (Silver)
│   └── gold/                # Dữ liệu đã phân tích NLP & Feature (Gold)
└── src/
    ├── crawler.py        # Module thu thập dữ liệu
    ├── preprocessing.py  # Module làm sạch dữ liệu text
    ├── llm_engine.py     # Module gọi AI (Groq/Gemini) & Fallback logic
    └── feature_engineering.py # Module tính toán chỉ số tài chính
```

## ⚙️ Cài đặt & Sử dụng

### 1. Clone dự án
```bash
git clone https://github.com/your-username/vn30-stock-prediction.git
cd vn30-stock-prediction
```

### 2. Cài đặt thư viện
```bash
pip install -r requirements.txt
```

### 3. Cấu hình môi trường
Tạo file `.env` tại thư mục gốc và điền API Key của bạn:
```env
GROQ_API_KEY=gsk_your_key_here
GOOGLE_API_KEY=AIza_your_key_here
```

### 4. Chạy hệ thống
```bash
python main.py
```
Hệ thống sẽ tự động thực hiện tuần tự: Crawl -> Preprocess -> NLP Analysis -> Feature Engineering.

## 📊 Output (Đến hiện tại - Sẽ cập nhật thêm)
Kết quả cuối cùng được lưu tại `data/processed/VN30_Daily_Features.csv` với các trường thông tin:
*   `daily_sentiment`: Điểm cảm xúc trong ngày.
*   `sentiment_decay`: Chỉ số tích lũy cảm xúc (Alpha signal).
*   `buzz_7d`: Tổng lượng tin tức trong 7 ngày.
*   `polarity_7d`: Độ lệch chuẩn tâm lý thị trường.

## 🤝 Đóng góp
Mọi đóng góp (Pull Request) đều được hoan nghênh. Vui lòng mở Issue trước khi thực hiện thay đổi lớn.

## 📜 License
MIT License
```

