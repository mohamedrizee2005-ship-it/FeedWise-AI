"""Central locations. Never write sensitive data into the tracked repository."""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "data" / "feedwise.db"
MODEL_PATH = ROOT / "models" / "sentiment_model.joblib"
COURSE_NAME_LIMIT = 100
COMMENT_LIMIT = 2000
MIN_COMMENT_LENGTH = 10
REVIEW_THRESHOLD = 0.70  # exploratory threshold, NOT calibrated accuracy
