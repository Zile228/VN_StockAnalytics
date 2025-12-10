# src/preprocessing.py
import pandas as pd
import re

def clean_text(text):
    if not isinstance(text, str): return ""
    text = re.sub(r'<.*?>', '', text) 
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def load_and_preprocess(filepath):
    print(f"Executing: Loading data from {filepath}...")
    df = pd.read_csv(filepath)
    
    # Xử lý ngày tháng
    df['date_dt'] = pd.to_datetime(df['date_time'], format='mixed', dayfirst=False)
    df['clean_time'] = df['date_dt'].dt.strftime('%Y-%m-%d %H:%M')
    
    df.columns = [c.lower() for c in df.columns] 
    
    df['full_text'] = df['title'].fillna('') + ". " + df['sapo'].fillna('')
    df['full_text'] = df['full_text'].apply(clean_text)
    
    # Lọc bài quá ngắn
    df = df[df['full_text'].str.len() > 20]
    
    print(f"Done: {len(df)} records ready for LLM.")
    return df