# src/crawler.py
import requests
from bs4 import BeautifulSoup
import pandas as pd
import re
import time
import random
from datetime import datetime, timedelta
import config  # Import config từ thư mục gốc

# Cấu hình crawler
NUM_PAGES_CAFEF = 5
DAYS_BACK_VNSTOCK = 5 

HEADERS_COMMON = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://tcinvest.tcbs.com.vn/'
}

# --- CÁC HÀM XỬ LÝ CAFEF ---
def cafef_clean_text(text):
    return text.strip().replace('\n', ' ').replace('\r', '').strip() if text else ""

def cafef_find_ticker(text, tickers):
    found = []
    if not text or len(text) < 10: return None
    for ticker in tickers:
        pattern = r'(?:\b|\()' + ticker + r'(?:\b|\))'
        if re.search(pattern, text, re.IGNORECASE):
            found.append(ticker)
    return ", ".join(sorted(list(set(found)))) if found else None

def cafef_get_zone_id(html_content):
    match = re.search(r"zoneId\s*=\s*['\"]?(\d+)['\"]?", str(html_content))
    if match: return match.group(1)
    soup = BeautifulSoup(html_content, 'html.parser')
    hidden_input = soup.find('input', {'id': 'hdZoneId'})
    if hidden_input: return hidden_input.get('value')
    return "36"

def cafef_parse_html(html_content, source_type="page"):
    soup = BeautifulSoup(html_content, 'html.parser')
    if source_type == "api":
        items = soup.find_all('div', class_='box-category-item')
        if not items: items = soup.find_all('li')
    else:
        items = soup.find_all('div', class_='box-category-item')

    extracted_data = []
    for item in items:
        try:
            title_tag = item.find('h3') or item.find('h4')
            if not title_tag: continue
            
            a_tag = title_tag.find('a')
            if not a_tag: continue

            title = cafef_clean_text(a_tag.get_text())
            link = a_tag.get('href')
            if link and not link.startswith('http'): link = "https://cafef.vn" + link

            sapo_tag = item.find('p', class_='sapo')
            sapo = cafef_clean_text(sapo_tag.get_text()) if sapo_tag else ""

            time_tag = item.find('span', class_='time-ago')
            raw_time = cafef_clean_text(time_tag.get('title')) if (time_tag and time_tag.get('title')) else ""
            if not raw_time and time_tag: raw_time = cafef_clean_text(time_tag.get_text())
            if not raw_time: raw_time = datetime.now().strftime("%Y-%m-%d %H:%M")
            
            full_text = f"{title} {sapo}"
            # Sử dụng list VN30 từ config
            related_ticker = cafef_find_ticker(full_text, config.VN30_TICKERS)

            if related_ticker:
                extracted_data.append({
                    "symbol": related_ticker, # Đổi tên cột ticker thành symbol cho đồng nhất
                    "date_time": raw_time,
                    "title": title,
                    "sapo": sapo,
                    "content_url": link,
                    "source": "CafeF"
                })
        except Exception:
            continue
    return extracted_data

def run_cafef_crawler():
    print(f"[CRAWLER] Đang lấy tin CafeF ({NUM_PAGES_CAFEF} trang)...")
    all_data = []
    zone_id = None
    url_p1 = "https://cafef.vn/doanh-nghiep.chn"
    
    try:
        resp = requests.get(url_p1, headers=HEADERS_COMMON, timeout=15)
        if resp.status_code == 200:
            data_p1 = cafef_parse_html(resp.content, source_type="page")
            all_data.extend(data_p1)
            zone_id = cafef_get_zone_id(resp.content)
    except Exception as e:
        print(f"Error CafeF Page 1: {e}")
        return []

    if not zone_id: return all_data

    for page in range(2, NUM_PAGES_CAFEF + 1):
        api_url = f"https://cafef.vn/timelinelist/{zone_id}/{page}.chn"
        try:
            resp = requests.get(api_url, headers=HEADERS_COMMON, timeout=10)
            if resp.status_code == 200 and len(resp.content) > 100:
                data_page = cafef_parse_html(resp.content, source_type="api")
                if data_page: all_data.extend(data_page)
            else: break
            time.sleep(random.uniform(0.5, 0.8))
        except Exception: continue

    print(f"   -> CafeF: Lấy được {len(all_data)} tin.")
    return all_data

# --- CÁC HÀM XỬ LÝ VNSTOCK/TCBS ---
def run_vnstock_crawler():
    print(f"[CRAWLER] Đang lấy tin TCBS ({DAYS_BACK_VNSTOCK} ngày)...")
    all_tcbs_data = []
    end_date = datetime.now()
    start_date = end_date - timedelta(days=DAYS_BACK_VNSTOCK)

    for sym in config.VN30_TICKERS: # Dùng list từ config
        api_url = f"https://apipubaws.tcbs.com.vn/tcanalysis/v1/ticker/{sym}/activity-news"
        params = {"page": 0, "size": 50}
        try:
            resp = requests.get(api_url, headers=HEADERS_COMMON, params=params, timeout=10)
            if resp.status_code != 200: continue

            data = resp.json()
            news_list = data.get('listActivityNews', [])
            
            for item in news_list:
                pub_date_str = item.get('publishDate', '')
                if not pub_date_str: continue
                try:
                    clean_date_str = pub_date_str.split('.')[0].replace('T', ' ')
                    news_date = datetime.strptime(clean_date_str, "%Y-%m-%d %H:%M:%S")
                except ValueError: continue

                if news_date < start_date: continue
                
                title = item.get('title', '')
                sapo = item.get('description', '')
                if not sapo: sapo = title

                all_tcbs_data.append({
                    "symbol": sym,
                    "date_time": news_date.strftime("%Y-%m-%d %H:%M"),
                    "title": title,
                    "sapo": sapo,
                    "content_url": f"https://tcinvest.tcbs.com.vn/market-watch?symbol={sym}",
                    "source": "TCBS"
                })
        except Exception: continue
            
    print(f"   -> TCBS: Lấy được {len(all_tcbs_data)} tin.")
    return all_tcbs_data

# --- HÀM CHÍNH (MAIN FUNCTION) ĐỂ GỌI TỪ BÊN NGOÀI ---
def get_market_news():
    """
    Hàm này chạy cả 2 crawler, gộp dữ liệu và lưu vào file CSV.
    Trả về đường dẫn file đã lưu.
    """
    cafef = run_cafef_crawler()
    vnstock = run_vnstock_crawler()
    
    total_data = cafef + vnstock
    output_path = config.DATA_RAW_DIR / "VN30_Merged_News.csv"

    if total_data:
        df = pd.DataFrame(total_data)
        
        # Xử lý sort
        df['sort_date'] = pd.to_datetime(df['date_time'], errors='coerce')
        df.sort_values(by=['symbol', 'sort_date'], ascending=[True, False], inplace=True)
        df.drop(columns=['sort_date'], inplace=True)
        
        # Xóa trùng
        df.drop_duplicates(subset=['symbol', 'title'], keep='first', inplace=True)
        
        # Lưu file
        df.to_csv(output_path, index=False, encoding='utf-8-sig')
        print(f"[SUCCESS] Đã lưu dữ liệu thô tại: {output_path}")
        print(f"Tổng số bài: {len(df)}")
    else:
        print("[WARNING] Không lấy được dữ liệu nào!")
    
    return output_path