**Subject:** [UPDATE] Hoàn tất NLP Pipeline & Feature Engineering cho dự án VN30 Prediction


### ✅ CÁC HẠNG MỤC ĐÃ HOÀN THÀNH
1.  **Crawler:** Tự động lấy tin từ CafeF & TCBS, làm sạch dữ liệu và xử lý trùng lặp.
2.  **NLP Engine:** Tích hợp **Llama 3 (Groq)** và **Gemini (Google)** với cơ chế tự động chuyển đổi (Auto-fallback) để đảm bảo không bị gián đoạn khi hết quota.
3.  **Feature Store:** Đã chuyển đổi dữ liệu tin tức thô thành chuỗi thời gian (Time-series) sẵn sàng cho Model dự báo.

Cụ thể:
---

### A. Hệ thống Thu thập Dữ liệu (Data Collection) - Tầng Bronze
*   **Nguồn dữ liệu:** Đã kết nối thành công với 2 nguồn dữ liệu tài chính lớn nhất Việt Nam là **CafeF** và **TCBS**.
*   **Phạm vi:** Toàn bộ rổ chỉ số VN30.
*   **Khả năng:** Crawl dữ liệu lịch sử (180 ngày) và cập nhật tin tức mới hàng ngày. Dữ liệu bao gồm: Tiêu đề, Sapo, Thời gian ra tin, Mã cổ phiếu liên quan.

### B. Động cơ Phân tích Ngôn ngữ Tự nhiên (NLP Engine) - Tầng Silver
Chiến lược **"Smart Cascading Fallback"**:
*   **Cơ chế hoạt động:** Hệ thống tự động điều phối giữa các mô hình AI:
    1.  **Ưu tiên 1:** Sử dụng **Llama 3.3 70B (qua Groq)** để đạt độ chính xác cao nhất về phân tích ngữ nghĩa tiếng Việt.
    2.  **Ưu tiên 2:** Tự động chuyển sang **Llama 3.1 8B** (Tốc độ cực nhanh, >1000 tokens/s) khi gặp giới hạn tài nguyên.
    3.  **Ưu tiên 3:** Tự động chuyển sang **Google Gemini Flash** làm lớp dự phòng cuối cùng.
*   **Kết quả:** Hệ thống vận hành liên tục 24/7 không bị gián đoạn (Zero Downtime) do giới hạn API, chi phí vận hành bằng 0 (tận dụng Free Tier).

### C. LOGIC TÍNH TOÁN CÁC CHỈ SỐ (QUAN TRỌNG) - Tầng Gold
Đây là phần lõi của hệ thống (Gold Layer). Thay vì dùng điểm số thô, ta tính toán 4 chỉ số phái sinh sau để phản ánh đúng tâm lý thị trường:

#### **A. Daily Weighted Sentiment (Cảm xúc trọng số trong ngày)**
*   **Vấn đề:** Một ngày có nhiều tin, tin rác không nên ảnh hưởng bằng tin chính thống.
*   **Công thức:**

    Score_daily = sum(Score_i * Relevance_i) / sum(Relevance_i)

    Trong đó:
    - Score_i ∈ [-5, 5]
    - Relevance_i ∈ [0, 1]
  
*   **Ý nghĩa:** Tin nào AI đánh giá là "liên quan trực tiếp đến giá cổ phiếu" sẽ có sức nặng lớn hơn.

#### **B. Sentiment Decay (Dư âm cảm xúc - Alpha Signal)**
*   **Vấn đề:** Tin tốt ra hôm nay (+5 điểm) không biến mất ngay ngày mai. Nó vẫn còn tác động tâm lý nhưng giảm dần.
*   **Công thức (Exponential Decay):**

    Sentiment Decay (Exponential Decay):

    S_t = S_new + (S_{t-1} * alpha)
    
    Trong đó:
    - S_new: sentiment từ tin tức trong ngày
    - alpha = 0.85: hệ số lãng quên (decay factor)

*   **Ý nghĩa:** Đây là chỉ số quan trọng nhất để bắt trend. Nó giúp model hiểu được "đà" tâm lý tích lũy của nhà đầu tư qua nhiều ngày.

#### **C. Buzz Volume 7D (Độ ồn ào tuần)**
*   **Công thức:** Tổng số lượng bài báo nhắc đến mã cổ phiếu trong **cửa sổ trượt 7 ngày (Rolling Window)**.
*   **Ý nghĩa:** Đo lường sự chú ý của đám đông (FOMO hoặc Panic). Nếu Buzz tăng vọt mà Sentiment âm -> Dấu hiệu bán tháo.

#### **D. Polarity 7D (Độ phân cực/Rủi ro)**
*   **Công thức:** Độ lệch chuẩn (Standard Deviation) của điểm Sentiment trong 7 ngày gần nhất.
*   **Ý nghĩa:**
    *   Polarity thấp: Thị trường đồng thuận (Cùng mua hoặc cùng bán).
    *   Polarity cao: Thị trường đang "đánh nhau" (Có người khen, có kẻ chê) -> **Rủi ro biến động giá cao**.

---

### 🛠 3. ĐIỂM NHẤN KỸ THUẬT (TECHNICAL HIGHLIGHTS)
*   **Smart Cascading Fallback:** Hệ thống ưu tiên chạy model xịn nhất (**Llama 3.3 70B**) -> Nếu quá tải tự động chuyển sang bản nhẹ (**Llama 3.1 8B**) -> Nếu lỗi mạng tự động sang **Google Gemini**.
    *   *Kết quả:* Tốc độ xử lý trung bình **<1s/bài báo**, chi phí API hiện tại là **$0**.
*   **Atomic Write:** Dữ liệu được lưu trữ realtime từng dòng, đảm bảo an toàn tuyệt đối ngay cả khi server bị ngắt điện giữa chừng.

### 📅 4. KẾ HOẠCH TIẾP THEO (NEXT ACTIONS)
*   **Tuần này:** 
*   **Mục tiêu:** 
