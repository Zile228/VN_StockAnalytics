# config.py
import os
from pathlib import Path

try:
    # Optional: load from .env if present, but do not require it at runtime.
    from dotenv import load_dotenv  # type: ignore

    load_dotenv()
except Exception:
    pass

# --- Environment / LLM ---
# The orchestrator supports "LLM disabled mode" if no key is provided.
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
LLM_PROVIDER = os.environ.get("LLM_PROVIDER", "disabled").lower()  # disabled|openai|groq
LLM_DISABLED = os.environ.get("LLM_DISABLED", "").lower() in {"1", "true", "yes"}


def llm_enabled() -> bool:
    if LLM_DISABLED:
        return False
    if LLM_PROVIDER == "groq":
        return bool(GROQ_API_KEY)
    if LLM_PROVIDER == "openai":
        return bool(OPENAI_API_KEY)
    return False


# --- Paths ---
BASE_DIR = Path(__file__).parent
DATA_RAW_DIR = BASE_DIR / "data" / "bronze"
DATA_PROCESSED_DIR = BASE_DIR / "data" / "silver"
DATA_TIMESERIES_DIR = BASE_DIR / "data" / "timeseries"
OUTPUT_DIR = BASE_DIR / "output"

# Ensure folders exist
os.makedirs(DATA_RAW_DIR, exist_ok=True)
os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- CONSTANTS ---
VN30_TICKERS = [
    "ACB", "BCM", "BID", "BVH", "CTG", "FPT", "GAS", "GVR", "HDB", "HPG",
    "MBB", "MSN", "MWG", "PLX", "POW", "SAB", "SHB", "SSB", "SSI", "STB",
    "TCB", "TPB", "VCB", "VHM", "VIB", "VIC", "VJC", "VNM", "VPB", "VRE"
]

# Data file locations (mock API reads local files)
VN30_HISTORY_CSV = DATA_TIMESERIES_DIR / "vn30_history.csv"
NEWS_MERGED_CSV = DATA_RAW_DIR / "VN30_Merged_News.csv"
SENTIMENT_ANALYZED_CSV = DATA_PROCESSED_DIR / "VN30_Sentiment_Analyzed.csv"
MACRO_XLSX = DATA_TIMESERIES_DIR / "macro.xlsx"
USDVND_CSV = DATA_TIMESERIES_DIR / "Dữ-liệu-Lịch-sử-USD_VND-1.csv"