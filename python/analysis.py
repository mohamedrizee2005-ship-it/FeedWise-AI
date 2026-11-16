"""Turn authorized feedback into reviewable results and a spreadsheet-safe CSV."""
import csv
import hashlib
import io
import sqlite3
from collections import Counter
from pathlib import Path
import database as db
import ml
from insights import detect_topics, summarize


class FeedbackAnalysis:
    """Keep analysis independent of Streamlit so it can be tested directly."""

    def __init__(self, review_token):
        self.review_token = review_token
        self.model_version = None
        self.model_error = None

    def results(self):
        rows = db.owner_feedback(self.review_token)
        predictions = {}
        try:
            path = Path(ml.MODEL_PATH)
            self.model_version = hashlib.sha256(path.read_bytes()).hexdigest()
            predictions = db.prediction_cache(self.review_token,self.model_version)
            missing = [r for r in rows if r['id'] not in predictions]
            if missing:
                inferred = ml.analyze([r['comment'] for r in missing])
                if len(inferred) != len(missing):
                    raise ValueError('Unexpected number of predictions.')
                for row,(label,probability) in zip(missing,inferred):
                    db.save_prediction(self.review_token,row['id'],self.model_version,label,probability)
                    predictions[row['id']] = (label,probability)
        except sqlite3.Error:
            raise
        except Exception:
            # Feedback and human review must remain available without a usable model.
            self.model_error = 'AI is unavailable. Feedback and manual review still work. Run python setup.py to rebuild the model.'
        results = []
        for row in rows:
            label,probability = predictions.get(row['id'],(None,None))
            human = row['human_label']
            results.append({'id':row['id'],'comment':row['comment'],'rating':row['rating'],
                'created_at':row['created_at'],'ai':label,'probability':probability,'human':human,
                'effective':human or label or 'unreviewed','topics':detect_topics(row['comment'])})
        return results

    @staticmethod
    def counts(results):
        return Counter(r['effective'] for r in results)

    @staticmethod
    def negative_topics(results):
        return Counter(topic for r in results if r['effective']=='negative' for topic in r['topics'])

    @staticmethod
    def summary(title, results):
        return summarize(title,[r['effective'] for r in results])


def safe_cell(value):
    text = '' if value is None else str(value)
    # Prevent comments/titles from becoming formulas when opened in a spreadsheet.
    return "'"+text if text.lstrip().startswith(('=','+','-','@')) else text


def export_csv(results, model_version):
    stream = io.StringIO(newline='')
    writer = csv.writer(stream)
    writer.writerow(['feedback_id','created_at_utc','comment','rating','ai_suggestion',
                     'ai_probability','human_label','effective_label','topics','model_version'])
    for r in results:
        writer.writerow([safe_cell(v) for v in [r['id'],r['created_at'],r['comment'],r['rating'],
            r['ai'],r['probability'],r['human'],r['effective'],', '.join(r['topics']),model_version]])
    return stream.getvalue().encode('utf-8-sig')
