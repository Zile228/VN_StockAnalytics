# config.py
import os
from dotenv import load_dotenv
from pathlib import Path

# Load biến môi trường từ file .env
load_dotenv()

# Lấy API Key
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Thiết lập đường dẫn động (Dynamic Paths)
BASE_DIR = Path(__file__).parent
DATA_RAW_DIR = BASE_DIR / "data" / "bronze"
DATA_PROCESSED_DIR = BASE_DIR / "data" / "silver"

# Đảm bảo thư mục tồn tại
os.makedirs(DATA_RAW_DIR, exist_ok=True)
os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)

# --- CONSTANTS ---
VN30_TICKERS = [
    "ACB", "BCM", "BID", "BVH", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG",
    "MBB", "MSN", "MWG", "PLX", "POW", "SAB", "SHB", "SSB", "SSI", "STB",
    "TCB", "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VRE"
]