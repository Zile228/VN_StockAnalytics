# main.py
import sys
import os
import config
from src.news_crawler import get_market_news       
from src.preprocessing import load_and_preprocess
from src.news_sentiment import run_sentiment_analysis

def main():
    print("=== BẮT ĐẦU QUÁ TRÌNH THU THẬP & PHÂN TÍCH DỮ LIỆU ===")

    # BƯỚC 1: CRAWL DATA (BRONZE LAYER)
    # Hàm này sẽ tự chạy crawler và lưu file vào data/raw/
    raw_data_path = get_market_news()

    if not os.path.exists(raw_data_path):
        print("Dừng chương trình do không có dữ liệu đầu vào.")
        return

    # BƯỚC 2: PREPROCESS (SILVER LAYER)
    # Load file vừa crawl được lên
    df_clean = load_and_preprocess(raw_data_path)
    
    if df_clean.empty:
        print("Dữ liệu sau khi làm sạch bị rỗng.")
        return

    # (Optional) Test mode: Chỉ chạy 5 dòng đầu để tiết kiệm tiền/thời gian
    # df_clean = df_clean.head(5) 

    # BƯỚC 3: NLP ANALYSIS (ENRICHMENT)
    output_file = config.DATA_PROCESSED_DIR / "VN30_Sentiment_Analyzed.csv"
    
    # Truyền output_file vào để hàm biết chỗ mà check xem đã chạy chưa
    df_final = run_sentiment_analysis(df_clean, output_file=output_file)

    # BƯỚC 4: SAVE OUTPUT (Ghi đè lại file hoàn chỉnh)
    df_final.to_csv(output_file, index=False, encoding='utf-8-sig')
    
    print(f"\n=== HOÀN TẤT ===")
    print(f"Kết quả đã được lưu tại: {output_file}")

if __name__ == "__main__":
    main()