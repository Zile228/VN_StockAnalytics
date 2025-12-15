# 📈 VN Stock Analytics - Hệ Thống Phân Tích Chứng Khoán Việt Nam

> **Dự án môn học Data Mining - Đại học Kinh tế TP.HCM (UEH) - Kỳ 5**

## 📋 Giới thiệu

**VN Stock Analytics** là một ứng dụng web phân tích chứng khoán Việt Nam được xây dựng với mục tiêu áp dụng các kỹ thuật **Data Mining** và **Machine Learning** vào lĩnh vực tài chính. Ứng dụng cung cấp các công cụ hỗ trợ nhà đầu tư trong việc phân tích, dự báo và ra quyết định đầu tư thông minh.

## ✨ Tính năng chính

### 1. 📊 Dashboard - Tổng quan thị trường
- Hiển thị chỉ số VNINDEX theo thời gian thực
- Thống kê số lượng cổ phiếu tăng/giảm giá
- Biểu đồ giá và khối lượng giao dịch
- Bảng danh sách cổ phiếu với các chỉ số cơ bản

### 2. 🔍 Stock Explorer - Khám phá cổ phiếu
- Tìm kiếm và xem chi tiết từng mã cổ phiếu
- Phân tích kỹ thuật với các chỉ báo: RSI, MA, MACD
- Biểu đồ nến (Candlestick) và biểu đồ giá

### 3. 💼 Portfolio Builder - Xây dựng danh mục
- Tạo và quản lý danh mục đầu tư
- Tối ưu hóa tỷ trọng phân bổ tài sản
- Phân tích rủi ro và lợi nhuận kỳ vọng

### 4. 📉 Backtest - Kiểm thử chiến lược
- Kiểm thử chiến lược đầu tư trên dữ liệu lịch sử
- Tính toán các chỉ số hiệu suất: Sharpe Ratio, Max Drawdown, Win Rate
- So sánh hiệu suất với benchmark (VNINDEX)

### 5. ⚡ Signals - Tín hiệu giao dịch
- **Dự báo giá bằng ML**: Sử dụng các chỉ báo kỹ thuật (RSI, MA, Volatility, Momentum) để dự đoán xu hướng giá
- **Phân tích Sentiment (NLP)**: Phân tích cảm xúc tin tức tài chính tiếng Việt
- **Kết hợp đa nguồn**: Tổng hợp tín hiệu từ ML + NLP + Technical Analysis
- Đề xuất MUA/BÁN/GIỮ với mức độ tin cậy

### 6. 🎯 Advisory - Tư vấn đầu tư
- Đề xuất danh mục dựa trên hồ sơ rủi ro
- Phân tích và khuyến nghị đầu tư

### 7. 🎮 Simulation - Mô phỏng giao dịch
- Mô phỏng vốn đầu tư theo thời gian
- Chiến lược tự động: Take Profit / Stop Loss
- So sánh hiệu suất với benchmark

## 🛠️ Kỹ thuật Data Mining được áp dụng

### 1. Machine Learning - Dự báo giá cổ phiếu
```
📁 src/services/predictionService.ts
```
- **Feature Engineering**: Trích xuất đặc trưng từ dữ liệu giá
  - Return 1 ngày, 3 ngày
  - Moving Average (MA5, MA10)
  - RSI (Relative Strength Index)
  - Volatility (Độ biến động)
  - Momentum
- **Mô hình dự báo**: Kết hợp các tín hiệu có trọng số (mô phỏng Random Forest/XGBoost)

### 2. Natural Language Processing - Phân tích Sentiment
```
📁 src/services/sentimentService.ts
```
- **Rule-based Sentiment Analysis**: Phân tích cảm xúc dựa trên từ điển từ vựng tiếng Việt
- **Từ vựng tích cực**: tăng trưởng, lợi nhuận, đột phá, tiềm năng...
- **Từ vựng tiêu cực**: giảm, lỗ, rủi ro, khó khăn, khủng hoảng...
- Tính toán điểm sentiment (-1 đến 1)

### 3. Signal Generation Engine
```
📁 src/services/signalService.ts
```
- **Kết hợp đa nguồn**: ML Prediction + Sentiment + Technical Analysis
- **Scoring System**: Tính điểm mua/bán dựa trên nhiều tín hiệu
- **Risk Assessment**: Đánh giá mức độ rủi ro

### 4. Backtesting Engine
```
📁 src/services/backtestService.ts
```
- **Portfolio Simulation**: Mô phỏng danh mục đầu tư
- **Performance Metrics**: 
  - Total Return, Annualized Return
  - Sharpe Ratio
  - Max Drawdown
  - Win Rate

## 🏗️ Công nghệ sử dụng

| Công nghệ | Mô tả |
|-----------|-------|
| **Vite** | Build tool hiện đại, tốc độ cao |
| **React 18** | Thư viện UI component-based |
| **TypeScript** | JavaScript với static typing |
| **Tailwind CSS** | Utility-first CSS framework |
| **shadcn/ui** | Component library đẹp và accessible |
| **Recharts** | Thư viện biểu đồ cho React |
| **React Query** | Data fetching và state management |
| **React Router** | Routing cho React |
| **Lucide React** | Icon library |

## 📁 Cấu trúc dự án

```
stock-scout-pro/
├── src/
│   ├── components/           # React components
│   │   ├── advisory/         # Tư vấn đầu tư
│   │   ├── backtest/         # Kiểm thử chiến lược
│   │   ├── charts/           # Biểu đồ (Candlestick, Equity, Donut...)
│   │   ├── dashboard/        # Tổng quan thị trường
│   │   ├── explorer/         # Khám phá cổ phiếu
│   │   ├── layout/           # Header, Navigation
│   │   ├── notifications/    # Thông báo
│   │   ├── portfolio/        # Xây dựng danh mục
│   │   ├── signals/          # Tín hiệu giao dịch
│   │   ├── simulation/       # Mô phỏng
│   │   └── ui/               # UI components (shadcn/ui)
│   │
│   ├── services/             # Business logic & Data Mining
│   │   ├── predictionService.ts    # ML dự báo giá
│   │   ├── sentimentService.ts     # NLP phân tích sentiment
│   │   ├── signalService.ts        # Tổng hợp tín hiệu
│   │   ├── backtestService.ts      # Backtesting engine
│   │   ├── simulationService.ts    # Mô phỏng giao dịch
│   │   ├── portfolioService.ts     # Quản lý danh mục
│   │   └── advisoryService.ts      # Tư vấn đầu tư
│   │
│   ├── data/
│   │   └── mockData.ts       # Dữ liệu mẫu (VNINDEX, cổ phiếu, tin tức)
│   │
│   ├── hooks/                # Custom React hooks
│   ├── lib/                  # Utilities
│   └── pages/                # Các trang chính
│
├── public/                   # Static assets
├── package.json              # Dependencies
└── tailwind.config.ts        # Tailwind configuration
```

## 🚀 Hướng dẫn cài đặt

### Yêu cầu
- Node.js >= 18.x
- npm hoặc bun

### Các bước cài đặt

```bash
# 1. Clone repository
git clone <YOUR_GIT_URL>

# 2. Di chuyển vào thư mục dự án
cd stock-scout-pro

# 3. Cài đặt dependencies
npm install

# 4. Chạy development server
npm run dev
```

Ứng dụng sẽ chạy tại: `http://localhost:5173`

### Scripts khả dụng

| Script | Mô tả |
|--------|-------|
| `npm run dev` | Chạy development server |
| `npm run build` | Build production |
| `npm run preview` | Preview production build |
| `npm run lint` | Kiểm tra lỗi với ESLint |

## 📸 Screenshots

### Dashboard - Tổng quan thị trường
- Hiển thị VNINDEX và các chỉ số thị trường
- Bảng danh sách cổ phiếu với giá và thay đổi

### Signals - Tín hiệu giao dịch
- Tổng hợp tín hiệu MUA/BÁN từ ML + NLP + TA
- Hiển thị mức độ tin cậy và lý do đề xuất

### Backtest - Kiểm thử chiến lược
- Biểu đồ equity curve
- Các chỉ số hiệu suất chi tiết

## 👥 Thành viên nhóm

| STT | Họ và Tên | MSSV | Vai trò |
|-----|-----------|------|---------|
| 1 | [Tên thành viên 1] | [MSSV] | [Vai trò] |
| 2 | [Tên thành viên 2] | [MSSV] | [Vai trò] |
| 3 | [Tên thành viên 3] | [MSSV] | [Vai trò] |

## 📚 Tài liệu tham khảo

- [React Documentation](https://react.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Recharts](https://recharts.org/)
- Technical Analysis: RSI, MACD, Moving Average
- Sentiment Analysis for Vietnamese

## 📄 License

Dự án này được phát triển cho mục đích học tập tại **Đại học Kinh tế TP.HCM (UEH)**.

---

<div align="center">

**📊 VN Stock Analytics - Data Mining Project**

*Đại học Kinh tế TP.HCM (UEH) - Kỳ 5*

Made with ❤️ using React + TypeScript

</div>
