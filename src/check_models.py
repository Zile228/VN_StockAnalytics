# check_models.py
import google.generativeai as genai
import os
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

print("--- DANH SÁCH MODEL KHẢ DỤNG ---")
try:
    available_models = []
    for m in genai.list_models():
        if 'generateContent' in m.supported_generation_methods:
            print(f"- {m.name}")
            available_models.append(m.name)
            
    print("\n------------------------------------------------")
    
    # Tự động test thử model tốt nhất tìm được
    target_model = None
    
    # Ưu tiên tìm Flash -> Pro 1.5 -> Pro thường
    if 'models/gemini-1.5-flash' in available_models:
        target_model = 'gemini-1.5-flash'
    elif 'models/gemini-1.5-pro' in available_models:
        target_model = 'gemini-1.5-pro'
    elif 'models/gemini-pro' in available_models:
        target_model = 'gemini-pro'
        
    if target_model:
        print(f"Testing model: {target_model}...")
        model = genai.GenerativeModel(target_model)
        response = model.generate_content("Hello")
        print("=> GỌI THÀNH CÔNG! Hãy dùng tên model này trong code chính.")
    else:
        print("=> KHÔNG TÌM THẤY MODEL GEMINI NÀO PHÙ HỢP.")
        
except Exception as e:
    print(f"LỖI KHI LẤY DANH SÁCH: {e}")