# TÀI LIỆU MÔ TẢ GIAO DIỆN

## Hệ thống VN Stock Analytics

## 1. Mục tiêu thiết kế giao diện

Hệ thống VN Stock Analytics được thiết kế dành cho **người mới tập chơi chứng khoán**, chưa có nhiều kinh nghiệm về phân tích kỹ thuật hay mô hình tài chính. Vì vậy, giao diện tập trung vào ba nguyên tắc cốt lõi:

* **Đơn giản hóa thông tin**: chỉ hiển thị các chỉ số quan trọng, tránh gây quá tải nhận thức.
    
* **Trực quan hóa dữ liệu**: ưu tiên biểu đồ, màu sắc, tín hiệu thay cho bảng số phức tạp.
    
* **Giải thích rõ ràng**: mọi tín hiệu và dự báo đều đi kèm lý do và mức độ tin cậy.
    

Giao diện được thiết kế theo hướng “**quan sát → hiểu → ra quyết định**”, giúp người dùng từng bước tiếp cận phân tích chứng khoán một cách an toàn và có định hướng.

* * *

## 2. Các module giao diện chính

### 2.1 Dashboard – Tổng quan thị trường

**Mục tiêu giao diện**  
Dashboard đóng vai trò là **điểm truy cập đầu tiên** khi người dùng mở hệ thống, giúp họ nhanh chóng nắm được “bức tranh lớn” của thị trường chứng khoán Việt Nam.

**Thành phần giao diện chính**

* Biểu đồ biến động **VNINDEX theo thời gian thực**, hiển thị xu hướng tăng/giảm rõ ràng bằng màu sắc.
    
* Thống kê nhanh số lượng **cổ phiếu tăng – giảm – đứng giá** trong ngày.
    
* Phân bố mức biến động của toàn thị trường (market breadth).
    
* Danh sách các mã cổ phiếu nổi bật, hiển thị:
    
    * Giá hiện tại
        
    * Khối lượng giao dịch
        
    * Thay đổi % so với phiên trước
        

**Trải nghiệm người dùng**  
Người dùng chỉ cần nhìn vào Dashboard để biết:

* Thị trường đang tích cực hay tiêu cực
    
* Dòng tiền đang mạnh hay yếu
    
* Những mã cổ phiếu nào đang thu hút sự chú ý
    

Dashboard không yêu cầu thao tác phức tạp, phù hợp cho việc theo dõi hằng ngày.

* * *

### 2.2 Stock Explorer – Phân tích cổ phiếu chi tiết & Dự báo

**Mục tiêu giao diện**  
Stock Explorer là nơi người dùng **đi sâu vào từng mã cổ phiếu**, nhưng vẫn giữ mức độ dễ hiểu cho người mới.

**Thành phần giao diện chính**

* Biểu đồ giá dạng **Candlestick**, cho phép zoom theo khoảng thời gian.
    
* Các chỉ báo kỹ thuật phổ biến:
    
    * Moving Average (MA)
        
    * Relative Strength Index (RSI)
        
    * MACD
        
    * Khối lượng giao dịch
        
* Khu vực **tinh chỉnh tham số**:
    
    * Khoảng thời gian phân tích
        
    * Tham số chỉ báo
        
    * Thời gian dự đoán giá trong tương lai
        

**Dự báo giá & độ tin cậy**

* Hệ thống tích hợp mô hình Machine Learning để **dự báo xu hướng giá**.
    
* Kết quả dự báo được vẽ trực tiếp lên biểu đồ giá.
    
* Đi kèm là **thang đo độ tin cậy**, giúp người dùng hiểu rằng dự báo không phải là chắc chắn tuyệt đối.
    

**Kết hợp dữ liệu tin tức**

* Tin tức liên quan đến mã cổ phiếu được phân tích cảm xúc (tích cực / trung lập / tiêu cực).
    
* Cảm xúc được lượng hóa thành điểm số và đưa vào mô hình dự báo.
    
* Người dùng có thể quan sát mối liên hệ giữa tin tức và biến động giá.
    

* * *

### 2.3 Signals – Tín hiệu giao dịch tổng hợp

**Mục tiêu giao diện**  
Signals giúp người mới **không cần tự phân tích phức tạp** vẫn có thể nhận được gợi ý giao dịch có cơ sở.

**Cách hiển thị**

* Tín hiệu **MUA / BÁN / GIỮ** được trình bày rõ ràng bằng màu sắc và biểu tượng.
    
* Mỗi tín hiệu đi kèm:
    
    * Mức độ tin cậy
        
    * Tóm tắt lý do hình thành tín hiệu
        

**Nguồn dữ liệu tạo tín hiệu**

* Chỉ báo kỹ thuật
    
* Dự báo từ mô hình Machine Learning
    
* Phân tích cảm xúc tin tức bằng NLP
    

**Trải nghiệm người dùng**  
Người dùng không chỉ thấy “nên làm gì” mà còn hiểu “vì sao lại có khuyến nghị đó”, giúp xây dựng tư duy đầu tư thay vì phụ thuộc mù quáng.

* * *

### 2.4 Portfolio Builder – Xây dựng và quản lý danh mục

**Mục tiêu giao diện**  
Portfolio Builder hỗ trợ người dùng **tư duy đầu tư theo danh mục**, thay vì chỉ mua bán từng mã riêng lẻ.

**Thành phần giao diện chính**

* Giao diện chọn cổ phiếu và phân bổ tỷ trọng bằng thanh trượt.
    
* Gợi ý phân bổ theo:
    
    * Chiến lược tự chọn
        
    * Chiến lược tối ưu hóa rủi ro – lợi nhuận
        
* Hiển thị:
    
    * Lợi nhuận kỳ vọng
        
    * Mức độ rủi ro
        
    * Độ biến động danh mục
        

**Giá trị với người mới**  
Người dùng hiểu rõ hơn khái niệm **đa dạng hóa**, cũng như trade-off giữa lợi nhuận và rủi ro.

* * *

### 2.5 Backtest – Kiểm thử chiến lược đầu tư

**Mục tiêu giao diện**  
Backtest cho phép người dùng **kiểm chứng ý tưởng đầu tư trước khi áp dụng thực tế**.

**Thành phần giao diện chính**

* Chọn chiến lược và khoảng thời gian lịch sử.
    
* Biểu đồ giá trị danh mục theo thời gian.
    
* Các chỉ số hiệu suất:
    
    * Total Return
        
    * Sharpe Ratio
        
    * Max Drawdown
        
    * Win Rate
        

**So sánh benchmark**

* Danh mục được so sánh trực tiếp với VNINDEX.
    
* Người dùng dễ dàng thấy chiến lược của mình có thực sự hiệu quả hay không.
    

* * *

### 2.6 Advisory – Tư vấn đầu tư theo hồ sơ rủi ro

**Mục tiêu giao diện**  
Advisory giúp người dùng **chọn chiến lược phù hợp với bản thân**, thay vì chạy theo thị trường.

**Quy trình giao diện**

* Người dùng trả lời một số câu hỏi ngắn về:
    
    * Khẩu vị rủi ro
        
    * Mục tiêu lợi nhuận
        
    * Thời gian đầu tư
        
* Hệ thống đề xuất danh mục tương ứng:
    
    * Thận trọng
        
    * Cân bằng
        
    * Tăng trưởng
        

**Kết hợp Backtest**

* Mỗi danh mục đề xuất đều có kết quả backtest minh họa.
    
* Người dùng thấy được hiệu quả và rủi ro trong quá khứ trước khi quyết định.
    

* * *

### 2.7 Simulation – Mô phỏng giao dịch

**Mục tiêu giao diện**  
Simulation giúp người dùng **thực hành đầu tư trong môi trường an toàn**, không rủi ro tiền thật.

**Tính năng chính**

* Thiết lập quy tắc:
    
    * Take Profit
        
    * Stop Loss
        
    * Chiến lược giao dịch giả lập
        
* Mô phỏng biến động giá trị tài sản theo thời gian.
    
* So sánh hiệu suất với:
    
    * Chiến lược buy-and-hold
        
    * Benchmark thị trường
        

* * *

### 2.8 Trang giới thiệu & nội dung (Optional)

**Nội dung giao diện**

* Giới thiệu về hệ thống và các mô hình phân tích được sử dụng.
    
* Bài viết phân tích thị trường, kiến thức đầu tư cơ bản.
    
* Hướng dẫn người dùng:
    
    * Mở tài khoản chứng khoán
        
    * Cách đặt lệnh
        
    * Giới thiệu các sàn giao dịch phổ biến tại Việt Nam
        

**Mục tiêu**  
Giúp người mới **xây dựng nền tảng kiến thức**, không chỉ sử dụng công cụ mà còn hiểu bản chất đầu tư.
