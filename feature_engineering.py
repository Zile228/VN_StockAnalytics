import pandas as pd
import numpy as np
from tqdm import tqdm
# main.py
import sys
import os
import config
from src.news_crawler import get_market_news       
from src.preprocessing import load_and_preprocess
from src.news_sentiment import run_sentiment_analysis

def calculate_weighted_sentiment(group):
    """
    Tính Sentiment trung bình theo trọng số Relevance.
    Công thức: Sum(Score * Relevance) / Sum(Relevance)
    """
    if group['relevance'].sum() == 0:
        return 0
    return np.average(group['sentiment_score'], weights=group['relevance'])

def calculate_decay_sentiment(series, alpha=0.85):
    """
    Tính Sentiment tích lũy có trọng số lãng quên (Exponential Decay).
    S_t = S_new + S_{t-1} * alpha
    """
    result = [0.0] * len(series)
    current_val = 0.0
    
    for i, val in enumerate(series):
        # Cộng tin mới vào dư âm tin cũ
        current_val = val + (current_val * alpha)
        result[i] = current_val
        
    return result

def create_daily_features(input_path):
    print(f"Executing: Feature Engineering from {input_path}...")
    
    # 1. Load dữ liệu NLP
    df = pd.read_csv(input_path)
    
    # Chuyển đổi clean_time về datetime chuẩn (chỉ lấy Ngày, bỏ Giờ)
    # clean_time đang dạng "2024-01-01 10:30", ta chỉ cần "2024-01-01"
    df['date'] = pd.to_datetime(df['clean_time']).dt.normalize()
    
    # 2. Gộp dữ liệu theo Ngày (Aggregation)
    # Gom tất cả bài báo trong 1 ngày lại thành 1 dòng
    daily_groups = df.groupby(['symbol', 'date'])
    
    daily_df = daily_groups.agg({
        'sentiment_score': 'count', # Đếm số bài (Buzz)
    }).rename(columns={'sentiment_score': 'daily_buzz'})
    
    # Tính Sentiment trung bình có trọng số cho từng ngày
    # (Lưu ý: apply hơi chậm tí nhưng logic phức tạp nên cần dùng)
    daily_df['daily_sentiment'] = daily_groups.apply(calculate_weighted_sentiment)
    
    # Reset index để đưa symbol và date thành cột
    daily_df = daily_df.reset_index()
    
    # 3. Xử lý Time-series (Lấp đầy ngày thiếu)
    # Vì có ngày không có tin, ta cần tạo khung thời gian liên tục
    full_features = []
    unique_symbols = daily_df['symbol'].unique()
    
    print("Calculated rolling features...")
    
    for symbol in tqdm(unique_symbols, desc="Processing Symbols"):
        # Lọc data của 1 mã
        symbol_data = daily_df[daily_df['symbol'] == symbol].set_index('date')
        
        # Tạo range ngày đầy đủ từ min đến max của mã đó
        if symbol_data.empty: continue
        
        idx = pd.date_range(start=symbol_data.index.min(), end=symbol_data.index.max(), freq='D')
        symbol_data = symbol_data.reindex(idx)
        
        # Fill các giá trị NaN (ngày không có tin)
        symbol_data['symbol'] = symbol
        symbol_data['daily_buzz'] = symbol_data['daily_buzz'].fillna(0)
        symbol_data['daily_sentiment'] = symbol_data['daily_sentiment'].fillna(0)
        
        # 4. Tính toán các chỉ số Window (Rolling)
        
        # A. Buzz Volume 7 ngày (Tổng lượng tin tuần qua)
        symbol_data['buzz_7d'] = symbol_data['daily_buzz'].rolling(window=7, min_periods=1).sum()
        
        # B. Polarity 7 ngày (Độ lệch chuẩn tâm lý - Rủi ro tranh cãi)
        # Nếu std cao nghĩa là tâm lý trồi sụt thất thường
        symbol_data['polarity_7d'] = symbol_data['daily_sentiment'].rolling(window=7, min_periods=1).std().fillna(0)
        
        # C. Sentiment Trend (Trung bình 7 ngày)
        symbol_data['sentiment_7d_avg'] = symbol_data['daily_sentiment'].rolling(window=7, min_periods=1).mean()
        
        # D. Decay Sentiment (Tích lũy theo thời gian - Quan trọng nhất)
        symbol_data['sentiment_decay'] = calculate_decay_sentiment(symbol_data['daily_sentiment'].values)
        
        # E. (Optional) Signal đơn giản để visualize
        # Nếu decay > 5 -> Bullish, < -5 -> Bearish (Ngưỡng này tùy chỉnh sau)
        '''symbol_data['signal_class'] = pd.cut(symbol_data['sentiment_decay'], 
                                           bins=[-float('inf'), -5, 5, float('inf')],
                                           labels=['Bearish', 'Neutral', 'Bullish'])'''
        
        # Đưa date từ index ra cột
        symbol_data['date'] = symbol_data.index
        full_features.append(symbol_data)
        
    # Gộp lại thành 1 DataFrame lớn
    if not full_features:
        return pd.DataFrame()
        
    final_df = pd.concat(full_features, ignore_index=True)
    
    # Sắp xếp lại cho đẹp
    final_df = final_df[['date', 'symbol', 'daily_buzz', 'daily_sentiment', 
                         'buzz_7d', 'polarity_7d', 'sentiment_7d_avg', 'sentiment_decay']]
    
    return final_df

def main():
    # Đường dẫn file kết quả NLP
    nlp_output_path = config.DATA_PROCESSED_DIR / "VN30_Sentiment_Analyzed.csv"
    
    # 4. FEATURE ENGINEERING (GOLD - AGGREGATED)
    # Bước này tính toán chỉ số tổng hợp theo ngày
    if os.path.exists(nlp_output_path):
        df_features = create_daily_features(nlp_output_path)
        
        # Lưu kết quả cuối cùng
        feature_output_path = config.DATA_GOLD_DIR / "VN30_Daily_Features.csv"
        df_features.to_csv(feature_output_path, index=False)
        
        print(f"\n=== SUCCESS ===")
        print(f"Features created successfully: {len(df_features)} daily records.")
        print(f"Saved to: {feature_output_path}")
        print("Sample Data:")
        print(df_features.tail())
    else:
        print("Error: NLP Output file not found. Cannot create features.")

if __name__ == "__main__":
    main()