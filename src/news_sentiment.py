import json
import os
import time
import pandas as pd
from tqdm import tqdm
from groq import Groq
import google.generativeai as genai
import config

# --- CẤU HÌNH API ---
GROQ_AVAILABLE = bool(config.GROQ_API_KEY)
GEMINI_AVAILABLE = bool(os.getenv("GOOGLE_API_KEY"))

# Khởi tạo Clients
groq_client = Groq(api_key=config.GROQ_API_KEY) if GROQ_AVAILABLE else None

if GEMINI_AVAILABLE:
    genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

# --- HELPER: Tự động tìm tên model Gemini hợp lệ ---
def get_best_gemini_model():
    """Tìm xem tài khoản này có model nào dùng được"""
    if not GEMINI_AVAILABLE: return None
    try:
        # Lấy danh sách model hỗ trợ generateContent
        models = [m.name for m in genai.list_models() if 'generateContent' in m.supported_generation_methods]
        
        # Ưu tiên các model Flash (theo thứ tự mới nhất)
        # Sửa lại theo tên model thực tế bạn thấy (ví dụ 2.0-flash-exp)
        preferred = [
            'models/gemini-2.0-flash-exp', 
            'models/gemini-1.5-flash',
            'models/gemini-1.5-flash-latest',
            'models/gemini-2.0-flash',
            'models/gemini-2.5-flash',
            'models/gemini-pro' # Fallback cuối
        ]
        
        for p in preferred:
            if p in models: return p
            
        # Nếu không tìm thấy cái nào trong list ưu tiên, lấy cái đầu tiên tìm được
        return models[0] if models else None
    except:
        return 'models/gemini-2.5-flash' # Hardcode fallback

# Biến toàn cục lưu tên model Gemini đã chọn
CURRENT_GEMINI_MODEL = get_best_gemini_model()
print(f"Selected Gemini Model: {CURRENT_GEMINI_MODEL}")


# --- 1. CÁC HÀM GỌI MODEL ---

def call_groq(text, symbol, model_id="llama-3.3-70b-versatile"):
    """
    Hàm gọi Groq chung cho cả model to và nhỏ
    model_id: 
      - llama-3.3-70b-versatile (Khôn nhất)
      - llama-3.1-8b-instant (Nhanh nhất, limit cao nhất)
    """
    prompt = f"""
            Bạn là hệ thống phân tích cảm xúc tin tức chứng khoán và hoạt động doanh nghiệp Việt Nam.

            Mã cổ phiếu: {symbol}
            Nội dung tin:
            {text[:1000]}

            YÊU CẦU:
            Chỉ trả về JSON hợp lệ, không giải thích bên ngoài.
            - sentiment_score: số nguyên từ -5 (rất tiêu cực) đến 5 (rất tích cực) đến giá chứng khoán
            - relevance: số thực từ 0.0 (hoàn toàn không liên quan) đến 1.0 (liên quan trực tiếp) đến giá chứng khoán
            - category: "Kết quả Kinh doanh" hoặc "Chứng khoán & Nguồn vốn" hoặc "Quản trị & Hoạt động Doanh nghiệp"
            - reasoning: tối đa 50 từ

            JSON:
            {{
            "sentiment_score": 0,
            "relevance": 0.0,
            "category": "Kết quả kinh doanh",
            "reasoning": ""
            }}
            """
    
    try:
        completion = groq_client.chat.completions.create(
            model=model_id,
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
            response_format={"type": "json_object"}
        )
        return json.loads(completion.choices[0].message.content)
    except Exception as e:
        raise e

def call_gemini(text, symbol):
    if not CURRENT_GEMINI_MODEL: raise Exception("No Gemini model found")
    
    model = genai.GenerativeModel(CURRENT_GEMINI_MODEL,
        generation_config={"response_mime_type": "application/json"}
    )
    
    prompt = f"""
            Bạn là hệ thống phân tích cảm xúc tin tức chứng khoán và hoạt động doanh nghiệp Việt Nam.

            Mã cổ phiếu: {symbol}
            Nội dung tin:
            {text[:1000]}

            YÊU CẦU:
            Chỉ trả về JSON hợp lệ, không giải thích bên ngoài.
            - sentiment_score: số nguyên từ -5 (rất tiêu cực) đến 5 (rất tích cực) đến giá chứng khoán
            - relevance: số thực từ 0.0 (hoàn toàn không liên quan) đến 1.0 (liên quan trực tiếp) đến giá chứng khoán
            - category: "Kết quả Kinh doanh" hoặc "Chứng khoán & Nguồn vốn" hoặc "Quản trị & Hoạt động Doanh nghiệp"
            - reasoning: tối đa 50 từ

            JSON:
            {{
            "sentiment_score": 0,
            "relevance": 0.0,
            "category": "Kết quả kinh doanh",
            "reasoning": ""
            }}
            """
    try:
        response = model.generate_content(prompt)
        return json.loads(response.text)
    except Exception as e:
        raise e

# --- 2. HÀM ĐIỀU PHỐI (TIERED FALLBACK STRATEGY) ---

def analyze_smart_fallback(text, symbol):
    """
    Tier 1: Groq 70B (Best Quality)
    Tier 2: Groq 8B (High Speed Backup) -> Cứu cánh chính
    Tier 3: Gemini (Backup phụ)
    Tier 4: Sleep & Retry
    """
    
    # --- TIER 1: GROQ 70B ---
    if GROQ_AVAILABLE:
        try:
            return call_groq(text, symbol, "llama-3.3-70b-versatile"), "Groq-70B"
        except Exception as e:
            if "rate limit" not in str(e).lower() and "429" not in str(e):
                pass # Nếu lỗi server/input thì in ra, còn rate limit thì im lặng chuyển tiếp
                # print(f"Groq 70B Err: {e}")

    # --- TIER 2: GROQ 8B (Quan trọng: Limit thằng này rất cao) ---
    if GROQ_AVAILABLE:
        try:
            # Model 8b "instant" chạy cực nhanh và rẻ token
            return call_groq(text, symbol, "llama-3.1-8b-instant"), "Groq-8B"
        except Exception as e:
            pass

    # --- TIER 3: GEMINI ---
    if GEMINI_AVAILABLE:
        try:
            return call_gemini(text, symbol), f"Gemini-{CURRENT_GEMINI_MODEL}"
        except Exception as e:
            pass

    # --- TIER 4: ALL FAILED -> SLEEP ---
    print("\n[!] All limits hit (Groq 70b, 8b & Gemini). Sleeping 65s...", end="", flush=True)
    time.sleep(65)
    print(" Retrying...")
    return analyze_smart_fallback(text, symbol) # Đệ quy

# --- 3. PIPELINE & UTILS ---

def append_to_csv(row_dict, output_path):
    df_temp = pd.DataFrame([row_dict])
    header = not os.path.exists(output_path)
    df_temp.to_csv(output_path, mode='a', header=header, index=False, encoding='utf-8-sig')

def run_sentiment_analysis(df, output_file):
    
    # Checkpoint logic
    processed_ids = set()
    if os.path.exists(output_file):
        try:
            df_done = pd.read_csv(output_file)
            # Dùng combo Symbol + CleanTime làm key định danh để tránh trùng lặp
            # (Vì index số học có thể lệch nếu chạy filter)
            if 'symbol' in df_done.columns and 'clean_time' in df_done.columns:
                 # Tạo set các unique key đã chạy: "ACB_2024-01-01 10:00"
                df_done['unique_id'] = df_done['symbol'] + "_" + df_done['clean_time']
                processed_ids = set(df_done['unique_id'].tolist())
            print(f"Resuming... Found {len(df_done)} processed records.")
        except:
            print("Output file read error. Starting fresh.")

    # Tạo unique_id cho df đầu vào để lọc
    df['unique_id'] = df['symbol'] + "_" + df['clean_time']
    df_to_run = df[~df['unique_id'].isin(processed_ids)]
    
    print(f"Total: {len(df)} | Remaining: {len(df_to_run)}")
    if df_to_run.empty: return pd.read_csv(output_file)

    success_count = 0
    # Dùng tqdm để loop
    for idx, row in tqdm(df_to_run.iterrows(), total=len(df_to_run), desc="Processing"):
        text = row['full_text']
        symbol = row['symbol']
        
        # Gọi phân tích
        result, model_name = analyze_smart_fallback(text, symbol)
        
        # Lưu kết quả
        save_row = row.drop('unique_id').to_dict() # Bỏ cột unique_id tạm
        save_row.update({
            'sentiment_score': result.get('sentiment_score', 0),
            'relevance': result.get('relevance', 0),
            'category': result.get('category', 'Unknown'),
            'reasoning': result.get('reasoning', ''),
            'model_used': model_name
        })
        
        append_to_csv(save_row, output_file)
        success_count += 1
        
        # Ngủ 0.2s để giảm tải nếu Groq đang chạy quá nhanh (optional)
        time.sleep(0.2) 

    print(f"\nDone! Processed {success_count} items.")
    return pd.read_csv(output_file)