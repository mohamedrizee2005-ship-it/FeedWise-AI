"""Locations and small, shared limits for the one-app classroom workflow."""
import os
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get('FEEDWISE_DB_PATH', ROOT / 'data' / 'feedwise_links.db')).expanduser().resolve()
MODEL_PATH = Path(os.environ.get('FEEDWISE_MODEL_PATH', ROOT / 'models' / 'sentiment_model.joblib')).expanduser().resolve()
COMMENT_LIMIT = 2000
MIN_COMMENT_LENGTH = 10
REVIEW_THRESHOLD = 0.70
LABELS = ('positive', 'negative', 'neutral', 'mixed')
PAGE_SIZE = 10
