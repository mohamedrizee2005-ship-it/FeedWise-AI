"""Educational English sentiment baseline; probabilities are not accuracy."""
import csv
import os
import tempfile
from functools import lru_cache
import joblib
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline
from sklearn.model_selection import StratifiedKFold, cross_val_predict
from sklearn.metrics import accuracy_score, f1_score, confusion_matrix
from sklearn.dummy import DummyClassifier
from config import ROOT, MODEL_PATH


def training_rows():
    """Reject malformed, contradictory or insufficient training data early."""
    with (ROOT / 'training_data.csv').open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != ['text', 'label']:
            raise ValueError('Training CSV must have exactly text,label columns.')
        rows = list(reader)
    seen = {}
    for row in rows:
        text, label = (row.get('text') or '').strip(), (row.get('label') or '').strip()
        if not text or label not in ('positive', 'negative') or None in row:
            raise ValueError('Each training row needs nonempty text and a positive/negative label.')
        key = ' '.join(text.casefold().split())
        if key in seen:
            raise ValueError('Duplicate training text: remove duplicates before evaluation.')
        seen[key] = label
        row.update(text=text, label=label)
    if any(sum(r['label'] == label for r in rows) < 5 for label in ('positive', 'negative')):
        raise ValueError('At least five unique examples per class are required.')
    return rows


def build_pipeline():
    return Pipeline([
        ('tfidf', TfidfVectorizer(ngram_range=(1, 2), lowercase=True)),
        ('classifier', LogisticRegression(max_iter=2000, random_state=42))
    ])


def evaluate_model():
    """Out-of-fold demo metrics; vectorizer is fitted inside every fold."""
    rows = training_rows()
    texts, labels = [r['text'] for r in rows], [r['label'] for r in rows]
    predictions = cross_val_predict(build_pipeline(), texts, labels,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42))
    baseline = cross_val_predict(DummyClassifier(strategy='most_frequent'), texts, labels,
        cv=StratifiedKFold(n_splits=5, shuffle=True, random_state=42))
    return {'samples': len(rows), 'folds': 5,
            'baseline_accuracy': float(accuracy_score(labels, baseline)),
            'baseline_macro_f1': float(f1_score(labels, baseline, average='macro')),
            'accuracy': float(accuracy_score(labels, predictions)),
            'macro_f1': float(f1_score(labels, predictions, average='macro')),
            'labels': ['negative', 'positive'],
            'confusion_matrix': confusion_matrix(labels, predictions,
                labels=['negative', 'positive']).tolist(),
            'limitation': 'Tiny authored English demo dataset; not real-world validation.'}


def train_model():
    rows = training_rows()
    model = build_pipeline()
    model.fit([r['text'] for r in rows], [r['label'] for r in rows])
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    # A failed/interrupted retrain must not truncate an existing working model.
    fd, temporary = tempfile.mkstemp(dir=MODEL_PATH.parent, suffix='.joblib')
    os.close(fd)
    try:
        joblib.dump(model, temporary)
        os.replace(temporary, MODEL_PATH)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    return len(rows)


def load_model():
    if not MODEL_PATH.exists():
        raise FileNotFoundError('Model missing. Run setup.py first.')
    # Pickle-based: never load a model from an untrusted source.
    stat = MODEL_PATH.stat()
    return _cached_model(str(MODEL_PATH), stat.st_mtime_ns, stat.st_size)


@lru_cache(maxsize=2)
def _cached_model(path, modified_ns, size):
    """Invalidate the cached pipeline when the trusted local artifact changes."""
    return joblib.load(path)


def analyze(comments):
    if not comments:
        return []
    model = load_model()
    labels = model.predict(comments)
    probs = model.predict_proba(comments)
    return [(str(label), float(max(prob))) for label, prob in zip(labels, probs)]


if __name__ == '__main__':
    import json
    print(json.dumps(evaluate_model(), indent=2))
