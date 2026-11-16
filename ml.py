"""Educational sentiment model; not validated for university deployment."""
import csv
from pathlib import Path
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from config import ROOT, MODEL_PATH


def train_model():
    with (ROOT / 'training_data.csv').open(encoding='utf-8', newline='') as f:
        rows = list(csv.DictReader(f))
    X = [r['text'] for r in rows]
    y = [r['label'] for r in rows]
    model = Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
        ('classifier', LogisticRegression(max_iter=2000, random_state=42))
    ])
    model.fit(X, y)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(model, MODEL_PATH)
    return len(rows)


def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError('Model missing. Run setup.py first.')
    # joblib is pickle-based: only load local trusted models, never arbitrary uploads.
    return joblib.load(MODEL_PATH)


def analyze(comments):
    if not comments:
        return []
    model = load_model()
    labels = model.predict(comments)
    probs = model.predict_proba(comments)
    return [(str(label), float(max(prob))) for label, prob in zip(labels, probs)]
