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
DATA_GOLD_DIR = BASE_DIR / "data" / "gold"

# Ensure folders exist
os.makedirs(DATA_RAW_DIR, exist_ok=True)
os.makedirs(DATA_PROCESSED_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)
os.makedirs(DATA_GOLD_DIR, exist_ok=True)

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
BANK_XLSX = DATA_TIMESERIES_DIR / "bank.xlsx"

# Gold (canonical) outputs
USDVND_GOLD_CSV = DATA_GOLD_DIR / "usdvnd_daily.csv"
VN30_HISTORY_CLEAN_CSV = DATA_GOLD_DIR / "vn30_history_clean.csv"
FUNDAMENTALS_LONG_CSV = DATA_GOLD_DIR / "fundamentals_long.csv"
MODEL_DATASET_H7_CSV = DATA_GOLD_DIR / "model_dataset_h7.csv"
MODEL_DATASET_H7_META_JSON = DATA_GOLD_DIR / "model_dataset_h7.csv.meta.json"

# --- Model artifacts (Colab exports) ---
MODELS_DIR = BASE_DIR / "models"
ARTIFACTS_H7_DIR = MODELS_DIR / "artifacts_h7"
VAL_PREDICTIONS_CSV = ARTIFACTS_H7_DIR / "val_predictions.csv"
FEATURE_COLS_JSON = ARTIFACTS_H7_DIR / "feature_cols.json"
SCALER_JOBLIB = ARTIFACTS_H7_DIR / "scaler.joblib"
BILSTM_PT = ARTIFACTS_H7_DIR / "bilstm.pt"