# TECHNICAL DESIGN DOCUMENT

## VN STOCK ANALYTICS – DATA MINING–ORIENTED SYSTEM

* * *

## 1. Tổng quan hệ thống và mục tiêu thiết kế

### 1.1. Bối cảnh bài toán

Thị trường chứng khoán Việt Nam là một hệ thống động, chịu ảnh hưởng đồng thời từ:

* Biến động giá lịch sử của cổ phiếu
    
* Hoạt động doanh nghiệp (thông qua báo cáo tài chính)
    
* Yếu tố kinh tế vĩ mô
    
* Thông tin và tin tức trên truyền thông
    

Đối với nhà đầu tư cá nhân, đặc biệt là người mới, việc **kết hợp và phân tích đồng thời các nguồn dữ liệu này** là rất khó khăn do:

* Dữ liệu phân tán, không đồng nhất
    
* Quan hệ giữa các yếu tố không tuyến tính
    
* Ảnh hưởng của tin tức mang tính định tính, khó lượng hóa
    

Do đó, bài toán đặt ra không chỉ là **dự đoán giá**, mà quan trọng hơn là:

> _Khai phá tri thức ẩn trong dữ liệu để hiểu vì sao thị trường hoặc một cổ phiếu có xu hướng biến động theo một cách nhất định._

Đây chính là trọng tâm của **Data Mining**.

* * *

### 1.2. Mục tiêu của hệ thống (theo hướng Data Mining)

Hệ thống VN Stock Analytics được thiết kế với các mục tiêu chính sau:

1. **Tích hợp đa nguồn dữ liệu** (time series, tài chính, vĩ mô, tin tức) vào một pipeline thống nhất.
    
2. **Khai phá các mẫu (patterns) và mối quan hệ tiềm ẩn** giữa:
    
    * Giá cổ phiếu
        
    * Chỉ báo kỹ thuật
        
    * Yếu tố vĩ mô
        
    * Cảm xúc tin tức
        
3. **Biến kết quả mô hình thành tri thức có thể giải thích**, thay vì chỉ đưa ra dự đoán “hộp đen”.
    
4. **Hỗ trợ quyết định đầu tư** thông qua tín hiệu và danh mục, nhưng không thay thế hoàn toàn con người.
    

Hệ thống được xây dựng nhằm **phục vụ mục tiêu học thuật** của đồ án Data Mining, không phải một hệ thống giao dịch tự động.

* * *

## 2. Định nghĩa bài toán Data Mining

### 2.1. Loại bài toán

Hệ thống giải quyết **tổ hợp nhiều bài toán Data Mining**, bao gồm:

* **Time Series Forecasting**: dự đoán xu hướng giá cổ phiếu theo thời gian
    
* **Feature-based Pattern Mining**: khai phá mối quan hệ giữa các biến đầu vào và biến động giá
    
* **Text Mining & Sentiment Analysis**: trích xuất cảm xúc và mức độ ảnh hưởng từ tin tức
    
* **Decision Support Mining**: tổng hợp kết quả để hỗ trợ ra rõ quyết định
    

Quan trọng:

> Dự đoán chỉ là phương tiện, **tri thức rút ra từ dữ liệu mới là đích đến**.

* * *

### 2.2. Câu hỏi nghiên cứu (Research Questions)

Đồ án tập trung trả lời các câu hỏi sau:

1. Các yếu tố kỹ thuật, tài chính, vĩ mô và tin tức **tác động như thế nào** đến biến động giá cổ phiếu VN30?
    
2. Việc kết hợp **sentiment từ tin tức** có giúp cải thiện khả năng nhận diện xu hướng không?
    
3. Những **pattern nào cho thấy xác suất tăng/giảm cao** trong từng điều kiện thị trường?
    
4. Kết quả khai phá dữ liệu có thể được **chuyển hóa thành tri thức dễ hiểu** cho người dùng hay không?
    

* * *

## 3. Mô tả dữ liệu (Data Description)

### 3.1. Phạm vi dữ liệu

* **Khoảng thời gian**: 2015 – 2025
    
* **Tần suất**: theo ngày (daily)
    
* **Đối tượng phân tích**: 30 cổ phiếu thuộc rổ VN30
    

Khoảng thời gian 10 năm cho phép hệ thống quan sát:

* Nhiều chu kỳ thị trường (bull / bear / sideway)
    
* Các giai đoạn khủng hoảng và phục hồi
    
* Sự thay đổi cấu trúc thị trường theo thời gian
    

* * *

### 3.2. Nhóm dữ liệu chính

#### 3.2.1. Dữ liệu giá cổ phiếu (Market Data)

Đối với mỗi mã cổ phiếu VN30:

* Open
    
* High
    
* Low
    
* Close
    
* Volume
    

Đây là **dữ liệu nền tảng** cho toàn bộ pipeline, được sử dụng để:

* Tính toán các chỉ báo kỹ thuật
    
* Phân tích xu hướng
    
* Huấn luyện mô hình chuỗi thời gian
    

* * *

#### 3.2.2. Báo cáo tài chính doanh nghiệp (Fundamental Data)

Bao gồm các chỉ tiêu tài chính theo từng công ty:

* Doanh thu
    
* Lợi nhuận
    
* Các chỉ số tài chính quan trọng khác
    

Dữ liệu này có đặc điểm:

* Tần suất thấp hơn (quý/năm)
    
* Tác động dài hạn đến giá cổ phiếu
    

Trong hệ thống, dữ liệu tài chính được:

* Đồng bộ theo trục thời gian
    
* Dùng làm feature bổ trợ cho phân tích xu hướng trung – dài hạn
    

* * *

#### 3.2.3. Dữ liệu vĩ mô (Macro Data)

Bao gồm:

* Tỷ giá
    
* Giá vàng
    
* Các chỉ số thị trường chung
    

Vai trò:

* Phản ánh môi trường kinh tế tổng thể
    
* Giải thích các biến động đồng loạt của nhiều cổ phiếu
    

* * *

#### 3.2.4. Dữ liệu tin tức (Text Data)

Nguồn:

* Bài báo tài chính, chứng khoán
    

Quy trình xử lý:

* Trích xuất nội dung văn bản
    
* Phân tích cảm xúc (sentiment)
    
* Đánh giá **mức độ ảnh hưởng của bài báo đến từng mã cổ phiếu**
    

Dữ liệu tin tức giúp đưa yếu tố **định tính** vào mô hình định lượng.

* * *

## 4. Lý do lựa chọn tập dữ liệu (Data Justification)

Việc lựa chọn tập dữ liệu trên dựa trên các lý do:

1. **Tính thực tiễn cao**: dữ liệu phản ánh đúng thị trường Việt Nam.
    
2. **Đa chiều**: kết hợp dữ liệu định lượng và định tính.
    
3. **Phù hợp Data Mining**: có đủ độ phức tạp để khai phá tri thức.
    
4. **Đủ dài hạn**: cho phép quan sát pattern ổn định và bất thường.
    

* * *

## 5. Vai trò dữ liệu trong khai phá tri thức

Mỗi nhóm dữ liệu đóng một vai trò khác nhau trong quá trình Data Mining:

* Giá & Volume: hành vi thị trường
    
* Báo cáo tài chính: sức khỏe doanh nghiệp
    
* Vĩ mô: bối cảnh kinh tế
    
* Tin tức: yếu tố tâm lý và kỳ vọng
    

Tri thức được khai phá không đến từ **một nguồn riêng lẻ**, mà từ **sự tương tác giữa các nguồn dữ liệu** này.


* * *

# PHẦN 3. KIẾN TRÚC TỔNG THỂ HỆ THỐNG (SYSTEM ARCHITECTURE)

## 3.1. Nguyên tắc thiết kế kiến trúc

Kiến trúc hệ thống VN Stock Analytics được thiết kế theo các nguyên tắc sau:

1. **Data-centric**: dữ liệu là trung tâm, mô hình chỉ là công cụ khai phá.
    
2. **Separation of Concerns**: mỗi tầng xử lý đảm nhiệm một vai trò rõ ràng.
    
3. **Explainability-first**: mọi đầu ra phải có khả năng giải thích.
    
4. **Phù hợp đồ án Data Mining**: ưu tiên tri thức và insight hơn hiệu năng thời gian thực.
    

Hệ thống **không phải** là hệ thống giao dịch tự động (auto-trading), mà là **Decision Support System**.

* * *

## 3.2. Tổng quan kiến trúc nhiều tầng

Kiến trúc hệ thống được chia thành 5 tầng chính:

1. **Data Layer** – Thu thập & lưu trữ dữ liệu
    
2. **Feature Engineering Layer** – Biến đổi dữ liệu thành đặc trưng
    
3. **Modeling Layer** – Khai phá pattern và học mô hình
    
4. **Knowledge & Reasoning Layer** – Trích xuất tri thức & diễn giải
    
5. **Presentation Layer** – Hiển thị kết quả & hỗ trợ quyết định
    

Luồng dữ liệu **đi một chiều**, đảm bảo:

> Dữ liệu → Pattern → Tri thức → Khuyến nghị

* * *

## 3.3. Data Layer – Tầng dữ liệu

### 3.3.1. Vai trò

Data Layer chịu trách nhiệm:

* Thu thập dữ liệu từ nhiều nguồn
    
* Chuẩn hóa định dạng và trục thời gian
    
* Lưu trữ phục vụ phân tích dài hạn
    

Đây là **nền móng** của toàn bộ hệ thống Data Mining.

* * *

### 3.3.2. Các nguồn dữ liệu tích hợp

**a. Market Time Series**

* 30 mã cổ phiếu VN30
    
* Dữ liệu HLOCV theo ngày (2015–2025)
    

**b. Fundamental Data**

* Báo cáo tài chính theo công ty
    
* Được ánh xạ theo thời gian công bố
    

**c. Macro Data**

* Tỷ giá
    
* Giá vàng
    
* Chỉ số thị trường chung
    

**d. News & Text Data**

* Bài báo tài chính
    
* Tin tức liên quan doanh nghiệp và thị trường
    

* * *

### 3.3.3. Lý do tồn tại (Data Mining perspective)

Data Layer cho phép:

* Quan sát dữ liệu **trong nhiều chu kỳ thị trường**
    
* Phát hiện pattern ổn định và pattern bất thường
    
* Tránh bias do dữ liệu ngắn hạn
    

* * *

## 4. FEATURE ENGINEERING & DATA TRANSFORMATION

## 4.1. Vai trò của Feature Engineering trong Data Mining

Trong Data Mining, **feature engineering là nơi tri thức bắt đầu hình thành**, không phải ở model.

Hệ thống không trực tiếp học từ dữ liệu thô, mà học từ:

> Các đặc trưng phản ánh hành vi thị trường, tâm lý nhà đầu tư và bối cảnh kinh tế.

* * *

## 4.2. Nhóm feature chính

### 4.2.1. Technical Features (từ HLOCV)

Được trích xuất từ dữ liệu giá và khối lượng, bao gồm:

* Return (ngày, tuần)
    
* Volatility
    
* Moving Averages (MA ngắn, trung, dài hạn)
    
* Momentum
    
* RSI
    
* MACD
    
* Volume-based indicators
    

**Lý do tồn tại**  
Những feature này đại diện cho:

* Xu hướng
    
* Động lượng
    
* Mức độ quá mua / quá bán
    

→ Đây là các pattern phổ biến trong hành vi thị trường.

* * *

### 4.2.2. Fundamental Features (báo cáo tài chính)

Bao gồm:

* Tăng trưởng doanh thu
    
* Biên lợi nhuận
    
* Các chỉ số tài chính quan trọng
    

**Đặc điểm**:

* Tần suất thấp
    
* Ảnh hưởng dài hạn
    

**Vai trò Data Mining**  
Giúp phân biệt:

* Biến động do đầu cơ ngắn hạn
    
* Biến động do nền tảng doanh nghiệp
    

* * *

### 4.2.3. Macro Features

Bao gồm:

* Biến động tỷ giá
    
* Biến động giá vàng
    
* Xu hướng thị trường chung
    

**Vai trò**  
Macro features cho phép mô hình:

* Nhận diện rủi ro hệ thống
    
* Hiểu biến động đồng loạt của nhiều cổ phiếu
    

* * *

### 4.2.4. Sentiment Features (Text Mining)

Từ dữ liệu bài báo, hệ thống trích xuất:

* Sentiment score (tích cực / trung lập / tiêu cực)
    
* Mức độ ảnh hưởng đến từng mã cổ phiếu
    

Các feature này được:

* Gán theo ngày
    
* Có thể sử dụng dạng rolling hoặc lagged
    

**Lý do tồn tại**  
Sentiment phản ánh **kỳ vọng và tâm lý**, một yếu tố không thể hiện trong giá ngay lập tức.

* * *

## 4.3. Đồng bộ dữ liệu đa tần suất

Do dữ liệu có tần suất khác nhau:

* Giá: hàng ngày
    
* Báo cáo tài chính: theo quý
    
* Tin tức: không đều
    

Hệ thống sử dụng:

* Time alignment
    
* Forward filling có kiểm soát
    
* Lagged features
    

Mục tiêu là:

> Giảm nhiễu nhưng vẫn giữ được thông tin mang tính nhân quả.

* * *

## 4.4. Giá trị Data Mining của Feature Layer

Feature Layer cho phép hệ thống:

* Biến dữ liệu thô thành **đối tượng khai phá**
    
* Tạo điều kiện cho mô hình học được pattern có ý nghĩa
    
* Hỗ trợ diễn giải kết quả về sau
    

* * *

### Kết thúc PHẦN 3 & 4

Ở **response tiếp theo**, tôi sẽ viết tiếp:

* **PHẦN 5: Modeling Layer – Khai phá pattern & học mô hình**
    
* **PHẦN 6: Đánh giá mô hình theo hướng Data Mining (không chỉ metric)**
    

Các phần này sẽ làm rõ:

* Vì sao chọn BiLSTM / XGBoost / TFT
    
* Tri thức nào được rút ra từ từng mô hình
    
* Cách chứng minh “có khai phá tri thức” với giảng viên
    

Nếu bạn muốn **giảm số model** hoặc **nhấn mạnh 1 model chủ đạo** cho gọn đồ án, hãy nói trước để tôi chỉnh ngay từ phần 5.

* * *

**You:**

Tiếp tục

* * *

**ChatGPT:**

Tôi tiếp tục **PHẦN 5 & PHẦN 6** của **Technical Design Document**, giữ đúng định hướng **Data Mining–oriented**, không code, tập trung vào **khai phá tri thức, vai trò mô hình, và cách đánh giá có ý nghĩa học thuật**.

* * *

# PHẦN 5. MODELING LAYER – KHAI PHÁ PATTERN TỪ DỮ LIỆU

## 5.1. Vai trò của Modeling Layer trong Data Mining

Trong hệ thống VN Stock Analytics, Modeling Layer **không được xem là “cỗ máy dự đoán”**, mà là **công cụ khai phá cấu trúc và mối quan hệ ẩn trong dữ liệu**.

Mục tiêu của tầng này là:

* Học được **pattern theo thời gian** của từng mã cổ phiếu
    
* Khám phá **mức độ đóng góp của các nhóm feature**
    
* Tạo ra **đầu ra trung gian (mid-output)** phục vụ diễn giải và ra quyết định
    

Do đó, mô hình được lựa chọn không chỉ dựa trên độ chính xác, mà còn dựa trên **khả năng hỗ trợ phân tích và giải thích**.

* * *

## 5.2. Chiến lược sử dụng nhiều mô hình

Hệ thống áp dụng **multi-model strategy** với mục tiêu:

* So sánh các góc nhìn khai phá khác nhau
    
* Tránh phụ thuộc vào một giả định mô hình duy nhất
    
* Làm rõ tính ổn định của pattern được phát hiện
    

Các mô hình được sử dụng bao gồm:

* XGBoost
    
* BiLSTM
    
* Temporal Fusion Transformer (TFT)
    

Mỗi mô hình đóng một vai trò khai phá khác nhau.

* * *

## 5.3. XGBoost – Khai phá mối quan hệ phi tuyến giữa feature và biến động giá

### 5.3.1. Lý do lựa chọn

XGBoost là mô hình học máy dạng cây tăng cường, phù hợp cho:

* Dữ liệu tabular
    
* Feature đa dạng (technical, fundamental, macro, sentiment)
    
* Quan hệ phi tuyến và tương tác giữa các biến
    

Trong bối cảnh Data Mining, XGBoost đặc biệt hữu ích vì:

* Có khả năng đánh giá **tầm quan trọng của feature**
    
* Dễ dàng phân tích ảnh hưởng tương đối của từng nhóm dữ liệu
    

* * *

### 5.3.2. Tri thức trích xuất được

Từ XGBoost, hệ thống có thể khai phá:

* Feature nào đóng vai trò chính trong việc dự đoán xu hướng
    
* Sentiment có thực sự bổ sung thông tin so với dữ liệu giá
    
* Ảnh hưởng tương đối giữa yếu tố kỹ thuật và yếu tố vĩ mô
    

Tri thức này giúp trả lời câu hỏi:

> _“Điều gì đang chi phối biến động giá trong từng giai đoạn?”_

* * *

## 5.4. BiLSTM – Khai phá cấu trúc phụ thuộc theo thời gian

### 5.4.1. Lý do lựa chọn

BiLSTM là mô hình chuỗi thời gian có khả năng:

* Ghi nhớ thông tin quá khứ dài hạn
    
* Nhận diện pattern tuần tự trong dữ liệu
    

So với các mô hình truyền thống, BiLSTM phù hợp để:

* Phân tích xu hướng
    
* Phát hiện điểm đảo chiều tiềm năng
    

* * *

### 5.4.2. Tri thức trích xuất được

Thông qua BiLSTM, hệ thống có thể quan sát:

* Pattern lặp lại trong các chu kỳ thị trường
    
* Tác động trễ (lag effect) của các biến đầu vào
    
* Sự khác biệt giữa giai đoạn ổn định và biến động mạnh
    

Đây là dạng tri thức **theo thời gian**, khó khai phá bằng mô hình tĩnh.

* * *

## 5.5. Temporal Fusion Transformer (TFT) – Khai phá quan hệ động và đa biến

### 5.5.1. Lý do lựa chọn

TFT được lựa chọn vì:

* Xử lý tốt dữ liệu chuỗi thời gian đa biến
    
* Phân biệt được biến tĩnh và biến động theo thời gian
    
* Cung cấp cơ chế attention hỗ trợ diễn giải
    

Trong đồ án Data Mining, TFT đóng vai trò:

> _Mô hình giúp hiểu sự thay đổi tầm quan trọng của feature theo thời gian._

* * *

### 5.5.2. Tri thức trích xuất được

TFT cho phép khai phá:

* Feature nào quan trọng ở từng giai đoạn thị trường
    
* Sự thay đổi vai trò của sentiment trong các pha khác nhau
    
* Mối quan hệ giữa biến động ngắn hạn và dài hạn
    

Tri thức này giúp chuyển từ:

> “Dự đoán tại một thời điểm”  
> sang  
> “Hiểu cơ chế vận hành của thị trường theo thời gian”

* * *

## 5.6. Mid-output – Đầu ra trung gian phục vụ Data Mining

Thay vì chỉ sử dụng output cuối cùng, hệ thống khai thác:

* Giá trị dự đoán trung gian
    
* Xác suất xu hướng
    
* Thông tin attention / importance
    

Mid-output đóng vai trò:

* Cầu nối giữa mô hình và tầng tri thức
    
* Cơ sở để giải thích tín hiệu và khuyến nghị
    

* * *

# PHẦN 6. ĐÁNH GIÁ MÔ HÌNH THEO HƯỚNG DATA MINING

## 6.1. Nguyên tắc đánh giá

Trong đồ án Data Mining, đánh giá **không chỉ là so sánh metric**, mà nhằm:

* Kiểm chứng tính ổn định của pattern
    
* Xác nhận tri thức khai phá có ý nghĩa
    
* Tránh overfitting học thuật
    

Do đó, hệ thống sử dụng **đa lớp đánh giá**.

* * *

## 6.2. Đánh giá định lượng (Quantitative Evaluation)

### 6.2.1. Đánh giá dự đoán giá

Sử dụng các chỉ số:

* MAE
    
* RMSE
    

Mục tiêu:

* Đánh giá sai số dự đoán
    
* So sánh tương đối giữa các mô hình
    

* * *

### 6.2.2. Đánh giá xu hướng (Directional Accuracy)

Hệ thống đánh giá:

* Khả năng dự đoán đúng hướng tăng/giảm
    
* Độ ổn định của tín hiệu theo thời gian
    

Đây là chỉ số quan trọng hơn giá trị tuyệt đối trong bối cảnh đầu tư.

* * *

## 6.3. Đánh giá dựa trên chiến lược (Backtesting-based Evaluation)

### 6.3.1. Mục tiêu

Backtest không nhằm tối đa hóa lợi nhuận, mà nhằm:

* Kiểm chứng tính ứng dụng của tri thức khai phá
    
* So sánh các kịch bản có/không có một nhóm feature
    

* * *

### 6.3.2. Các chỉ số sử dụng

* Total Return
    
* Sharpe Ratio
    
* Max Drawdown
    
* Win Rate
    

Thông qua backtest, hệ thống có thể trả lời:

> _Tri thức rút ra có giúp cải thiện quyết định đầu tư không?_

* * *

## 6.4. Đánh giá so sánh (Ablation Study)

Hệ thống thực hiện so sánh:

* Có sentiment vs không sentiment
    
* Có macro vs không macro
    
* Model đơn vs ensemble
    

Đây là bằng chứng mạnh nhất cho:

> _Giá trị thực sự của từng nhóm dữ liệu trong Data Mining._

* * *

### Kết thúc PHẦN 5 & 6

Ở **response tiếp theo**, tôi sẽ viết phần cuối:

* **PHẦN 7: Knowledge & Reasoning Layer – Trích xuất tri thức**
    
* **PHẦN 8: Integration với Portfolio & Decision Support**
    
* **PHẦN 9: Giới hạn hệ thống & hướng enables học thuật**
    

Phần này sẽ là **“chốt hạ” để giảng viên nhìn thấy rõ:  
đây là một đồ án Data Mining đúng nghĩa, không phải app AI trình diễn**.

* * *

**You:**

Tiếp tục

* * *

**ChatGPT:**

Tôi tiếp tục với **PHẦN 7, 8 và 9** – đây là **phần chốt học thuật**, nơi hệ thống của bạn **chuyển từ “AI dự đoán” sang “Data Mining trích xuất tri thức & hỗ trợ quyết định”**. Phần này đặc biệt quan trọng để **ăn điểm đồ án**.

* * *

# PHẦN 7. KNOWLEDGE & REASONING LAYER

## TRÍCH XUẤT TRI THỨC VÀ DIỄN GIẢI KẾT QUẢ

## 7.1. Vai trò của Knowledge Layer trong đồ án Data Mining

Knowledge & Reasoning Layer là tầng **quan trọng nhất** trong hệ thống theo góc nhìn Data Mining.  
Đây là nơi:

* Kết quả mô hình được **chuyển hóa thành tri thức**
    
* Các pattern được **diễn giải thành insight**
    
* Hệ thống trả lời câu hỏi:  
    **“Chúng ta học được gì từ dữ liệu?”**
    

Khác với các hệ thống AI thuần dự đoán, tầng này **không tạo ra giá trị số**, mà tạo ra **giá trị nhận thức**.

* * *

## 7.2. Đầu vào của Knowledge Layer

Knowledge Layer không làm việc trực tiếp với dữ liệu thô, mà sử dụng các **đầu ra trung gian (mid-output)** từ Modeling Layer, bao gồm:

* Giá trị dự đoán theo thời gian
    
* Xác suất xu hướng tăng/giảm
    
* Feature importance (XGBoost)
    
* Attention weights (TFT)
    
* Kết quả so sánh mô hình
    
* Kết quả backtest theo từng kịch bản
    

Các thông tin này đóng vai trò là **bằng chứng** để rút ra tri thức.

* * *

## 7.3. Loại tri thức được trích xuất

Hệ thống hướng tới trích xuất 4 nhóm tri thức chính:

### 7.3.1. Tri thức về hành vi giá (Price Behavior Knowledge)

Ví dụ:

* Những giai đoạn có volatility cao thường đi kèm độ tin cậy dự đoán thấp
    
* Các pattern đảo chiều thường xuất hiện sau chuỗi ngày sentiment tiêu cực kéo dài
    
* Xu hướng tăng bền vững thường cần sự đồng thuận của volume và sentiment
    

Đây là **tri thức mô tả (descriptive knowledge)**.

* * *

### 7.3.2. Tri thức về ảnh hưởng của feature (Feature Impact Knowledge)

Thông qua:

* Feature importance
    
* Ablation study
    

Hệ thống xác định:

* Feature nào mang tính quyết định trong từng giai đoạn
    
* Khi nào sentiment thực sự hữu ích
    
* Khi nào yếu tố vĩ mô lấn át yếu tố doanh nghiệp
    

Đây là **tri thức giải thích (explanatory knowledge)**.

* * *

### 7.3.3. Tri thức về điều kiện thị trường (Contextual Market Knowledge)

Ví dụ:

* Trong thị trường sideway, technical indicators có độ tin cậy thấp
    
* Trong thị trường biến động mạnh, sentiment đóng vai trò quan trọng hơn
    
* Một số chiến lược chỉ hiệu quả khi thanh khoản đủ lớn
    

Đây là **tri thức theo ngữ cảnh**, rất phù hợp với Data Mining.

* * *

### 7.3.4. Tri thức hỗ trợ quyết định (Decision-support Knowledge)

Tri thức được biểu diễn dưới dạng:

* Rule
    
* Điều kiện hiểu được
    

Ví dụ:

* Nếu xu hướng tăng + sentiment tích cực + drawdown thấp → ưu tiên giữ
    
* Nếu biến động mạnh + sentiment tiêu cực → hạn chế mở vị thế mới
    

📌 Lưu ý học thuật quan trọng:

> **Tri thức này không được sinh tự động bởi LLM**, mà được **tổng hợp từ kết quả Data Mining**.

* * *

## 7.4. Vai trò của LLM trong Knowledge Layer

LLM **không phải là model chính**, mà đóng vai trò:

* Tổng hợp kết quả từ nhiều module
    
* Diễn giải tri thức theo ngôn ngữ tự nhiên
    
* Giúp người dùng hiểu _“vì sao hệ thống khuyến nghị như vậy”_
    

LLM **không**:

* Tự đưa ra quyết định
    
* Tự tạo rule không dựa trên dữ liệu
    

Cách dùng này đảm bảo:

> Hệ thống vẫn là **Data Mining–driven**, không bị hiểu nhầm thành AI hộp đen.

* * *

# PHẦN 8. INTEGRATION VỚI PORTFOLIO & DECISION SUPPORT

## 8.1. Vai trò của Portfolio Builder trong hệ thống

Portfolio Builder không phải là một module độc lập, mà là **điểm hội tụ của tri thức**.

Nó sử dụng:

* Tín hiệu từ Modeling Layer
    
* Tri thức từ Knowledge Layer
    
* Nguyên lý tối ưu hóa Markowitz
    

Mục tiêu:

> Kiểm tra khả năng ứng dụng của tri thức khai phá vào quyết định đầu tư.

* * *

## 8.2. Markowitz Portfolio Optimization

### 8.2.1. Lý do lựa chọn Markowitz

Markowitz được chọn vì:

* Là mô hình tối ưu hóa cổ điển, dễ giải thích
    
* Có nền tảng toán học rõ ràng
    
* Phù hợp môi trường học thuật
    

Quan trọng hơn:

> Markowitz giúp tách rõ **Data Mining (tri thức)** và **Optimization (toán học)**.

* * *

### 8.2.2. Tích hợp với kết quả Data Mining

Các đầu vào cho Portfolio Builder bao gồm:

* Expected return (từ mô hình)
    
* Risk estimate (từ volatility & drawdown)
    
* Constraint theo tín hiệu (buy/hold/avoid)
    

Portfolio Builder **không tạo tri thức mới**, mà:

* Kiểm nghiệm tri thức trong môi trường giả lập
    
* Đánh giá tính nhất quán của insight
    

* * *

## 8.3. Backtest như một công cụ xác thực tri thức

Backtest được sử dụng để:

* So sánh chiến lược có/không sử dụng tri thức Data Mining
    
* Đánh giá tác động thực tế của từng nhóm feature
    

Đây là bằng chứng quan trọng để trả lời:

> _“Tri thức khai phá có thực sự hữu ích không?”_

* * *

# PHẦN 9. GIỚI HẠN HỆ THỐNG & HƯỚNG PHÁT TRIỂN HỌC THUẬT

## 9.1. Giới hạn của hệ thống

Hệ thống tồn tại một số giới hạn:

1. Dữ liệu tin tức phụ thuộc vào nguồn và chất lượng gán nhãn
    
2. Mô hình chuỗi thời gian khó tránh khỏi overfitting trong một số giai đoạn
    
3. Không xử lý yếu tố thanh khoản chi tiết theo từng phiên
    
4. Không triển khai giao dịch thực tế
    

Việc nêu rõ giới hạn giúp:

> Thể hiện tư duy học thuật trung thực, rất được giảng viên đánh giá cao.

* * *

## 9.2. Hướng phát triển mở rộng

Các hướng mở rộng có thể bao gồm:

* Khai phá pattern theo ngành
    
* Graph-based Data Mining giữa các cổ phiếu
    
* Thêm clustering để phân loại trạng thái thị trường
    
* So sánh thị trường Việt Nam với thị trường khác
    

* * *

## 9.3. Tổng kết giá trị Data Mining của hệ thống

Hệ thống VN Stock Analytics:

* Không chỉ dự đoán
    
* Không chỉ trình diễn AI
    
* Mà **thực hiện đầy đủ chu trình Knowledge Discovery**:
    
    * Thu thập dữ liệu
        
    * Biến đổi
        
    * Khai phá
        
    * Diễn giải
        
    * Ứng dụng
        

* * *

# KẾT LUẬN CUỐI CÙNG (CHO ĐỒ ÁN)

> VN Stock Analytics là một hệ thống Data Mining đúng nghĩa,  
> trong đó AI đóng vai trò công cụ khai phá,  
> còn tri thức và insight là sản phẩm cuối cùng.