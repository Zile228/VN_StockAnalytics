

vnstock-analytics/
│
├── app/                          # Backend API (FastAPI / Flask)
│   ├── main.py                   # Entry file
│   ├── api/                      # API routers
│   │   ├── stocks.py             # Fetch stock data
│   │   ├── prediction.py         # Prediction endpoints
│   │   ├── portfolio.py          # Optimization endpoints
│   │   └── user_action.py        # Gợi ý đặt lệnh
│   │
│   ├── core/                     # Cấu hình hệ thống
│   │   ├── config.py
│   │   ├── security.py
│   │   └── scheduler.py          # Cron jobs auto-update
│   │
│   ├── services/                 # Business logic
│   │   ├── feature_engineering.py
│   │   ├── model_inference.py
│   │   ├── portfolio_opt.py
│   │   ├── recommendation.py     # Logic gợi ý Buy/Sell/Hold
│   │   └── data_ingestion.py
│   │
│   ├── models/                   # ML/DL models
│   │   ├── lstm/
│   │   │   ├── model.py
│   │   │   └── weights.pth
│   │   ├── transformer/
│   │   │   ├── model.py
│   │   │   └── weights.pth
│   │   └── baseline/
│   │       └── linear_regression.pkl
│   │
│   ├── database/
│   │   ├── connection.py
│   │   ├── stock_schema.py
│   │   ├── prediction_schema.py
│   │   └── user_action_schema.py
│   │
│   └── utils/
│       ├── logger.py
│       ├── helpers.py
│       └── technical_indicators.py
│
│
├── data/                         # Dữ liệu Raw + Processed
│   ├── raw/
│   │   ├── vn30/
│   │   └── historical/
│   ├── processed/
│   ├── features/
│   └── external/                 # Dữ liệu từ API, TCBS, SSI,...
│
│
├── research/                     # Notebook phục vụ Data Mining / Modeling
│   ├── 01_EDA.ipynb
│   ├── 02_Feature_Engineering.ipynb
│   ├── 03_Model_Training.ipynb
│   ├── 04_Backtesting.ipynb
│   ├── 05_Portfolio_Optimization.ipynb
│   └── 06_Recommendation_System.ipynb
│
│
├── web/                          # Giao diện Web (React hoặc Next.js)
│   ├── public/
│   ├── src/
│   │   ├── pages/                # Dashboard, Stock Detail, Portfolio
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── services/             # Gọi API backend
│   │   ├── store/                # Zustand / Redux
│   │   └── styles/
│   └── package.json
│
│
├── pipeline/                     # Airflow / Prefect / Cron jobs
│   ├── dags/
│   │   ├── fetch_stock_data.py
│   │   ├── feature_pipeline.py
│   │   ├── train_model.py
│   │   └── auto_retrain.py
│   ├── configs/
│   └── logs/
│
│
├── docs/                         # Tài liệu dự án
│   ├── requirements.md
│   ├── architecture.md
│   ├── data_dictionary.md
│   ├── modeling_report.md
│   └── user_manual.md
│
│
├── tests/                       # Unit tests
│   ├── test_api.py
│   ├── test_models.py
│   ├── test_features.py
│   └── test_recommendations.py
│
│
├── docker/                      # Dockerfile + Compose
│   ├── Dockerfile.api
│   ├── Dockerfile.web
│   └── docker-compose.yml
│
├── .env
├── README.md
└── requirements.txt
